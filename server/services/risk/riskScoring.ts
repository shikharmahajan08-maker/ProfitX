// ═══════════════════════════════════════════════════════════════════════════
// ProfitX Deterministic Stock Risk Engine — Risk Scoring
// ═══════════════════════════════════════════════════════════════════════════
//
// Converts raw risk metrics into a normalized composite score (0–100).
//
// IMPORTANT: This is a ProfitX deterministic composite risk score.
// It is NOT an academically universal risk measure.
// It is designed to be explainable, testable, and useful for education.
//
// ═══════════════════════════════════════════════════════════════════════════

import type {
  RiskClassification,
  RiskComponent,
  RiskMetrics,
} from "./types";
import { RISK_THRESHOLDS } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Normalization Reference Ranges
// ───────────────────────────────────────────────────────────────────────────
//
// Each metric is normalized to 0–100 using a linear mapping between
// documented reference bounds. Values below "low" map to 0; above "high"
// map to 100.
//
// These ranges are calibrated for Indian equity markets and are intentionally
// somewhat conservative to produce meaningful differentiation between stocks.
//
// ───────────────────────────────────────────────────────────────────────────

const NORMALIZATION = {
  /**
   * Annualized volatility:
   * - 10% (low-vol blue-chip) → 0 risk contribution
   * - 60% (highly volatile small-cap) → 100 risk contribution
   * Reference: NSE Nifty 50 historical vol ~15-20%, small-caps 40-80%
   */
  volatility: { low: 0.10, high: 0.60 },

  /**
   * Maximum drawdown percentage:
   * - 5% → 0 risk contribution (minor pullback)
   * - 50% → 100 risk contribution (severe crash)
   * Reference: Large-cap drawdowns typically 10-30%, crashes 40-60%
   */
  drawdown: { low: 5, high: 50 },

  /**
   * Absolute beta deviation from 1.0:
   * - 0.0 deviation → 0 risk (moves with market)
   * - 2.0 deviation → 100 risk (very different from market)
   * Beta < 0 or >> 1 both indicate elevated risk.
   */
  beta: { low: 0.0, high: 2.0 },

  /**
   * VaR (95% daily):
   * - 1% → 0 risk contribution
   * - 6% → 100 risk contribution
   * Reference: Blue-chip daily VaR ~1-2%, volatile stocks ~3-5%
   */
  var: { low: 1, high: 6 },

  /**
   * Inverse Sharpe ratio mapping:
   * Sharpe >= 2.0 → 0 risk (excellent risk-adjusted returns)
   * Sharpe <= -1.0 → 100 risk (poor risk-adjusted returns)
   */
  sharpe: { good: 2.0, bad: -1.0 },
} as const;

// ───────────────────────────────────────────────────────────────────────────
// Component Weights
// ───────────────────────────────────────────────────────────────────────────
//
// Weights are designed to be redistributed if a metric is unavailable.
//
// Rationale for each weight:
//
// Volatility (30%): Primary risk indicator. Directly measures the
//   uncertainty of returns. The most universally accepted equity risk proxy.
//
// Drawdown (25%): Measures the worst observed capital loss. Captures
//   tail risk that volatility alone may underestimate.
//
// VaR (20%): Quantifies the worst-case daily loss at a confidence level.
//   Provides a concrete "how much could I lose?" answer.
//
// Sharpe/Downside (15%): Measures whether the stock compensates for its
//   risk with adequate returns. Poor Sharpe → taking risk without reward.
//
// Beta (10%): Market sensitivity. Lower weight because (a) it requires
//   a benchmark, and (b) for single-stock analysis, absolute risk matters
//   more than relative market sensitivity.
//
// ───────────────────────────────────────────────────────────────────────────

const BASE_WEIGHTS = {
  volatility: 0.30,
  drawdown: 0.25,
  var: 0.20,
  sharpe: 0.15,
  beta: 0.10,
} as const;

// ───────────────────────────────────────────────────────────────────────────
// Normalization Helpers
// ───────────────────────────────────────────────────────────────────────────

/** Linearly normalize a value between low and high to 0–100. */
function normalize(value: number, low: number, high: number): number {
  if (high <= low) return 50; // safety
  const clamped = Math.max(low, Math.min(high, value));
  return ((clamped - low) / (high - low)) * 100;
}

/** Clamp a value to the 0–100 range. */
function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ───────────────────────────────────────────────────────────────────────────
// Scoring
// ───────────────────────────────────────────────────────────────────────────

/**
 * Calculate the composite risk score and individual components from raw metrics.
 *
 * When a metric is unavailable, its weight is redistributed proportionally
 * among the available components so the final score always uses the full
 * 0–100 range.
 */
export function calculateRiskScore(metrics: RiskMetrics): {
  score: number;
  components: RiskComponent[];
} {
  // Build raw component scores
  const rawComponents: {
    key: keyof typeof BASE_WEIGHTS;
    name: string;
    rawScore: number | null;
    explanation: string;
  }[] = [];

  // 1. Volatility
  if (metrics.volatility) {
    const raw = normalize(
      metrics.volatility.annualizedVolatility,
      NORMALIZATION.volatility.low,
      NORMALIZATION.volatility.high,
    );
    const level =
      raw > 70 ? "High" : raw > 40 ? "Moderate" : raw > 15 ? "Low" : "Very low";
    rawComponents.push({
      key: "volatility",
      name: "Volatility Risk",
      rawScore: raw,
      explanation: `${level} historical volatility (${(metrics.volatility.annualizedVolatility * 100).toFixed(1)}% annualized).`,
    });
  } else {
    rawComponents.push({
      key: "volatility",
      name: "Volatility Risk",
      rawScore: null,
      explanation: "Insufficient data to calculate volatility.",
    });
  }

  // 2. Drawdown
  if (metrics.maxDrawdown) {
    const raw = normalize(
      metrics.maxDrawdown.maxDrawdownPercent,
      NORMALIZATION.drawdown.low,
      NORMALIZATION.drawdown.high,
    );
    const level =
      raw > 70 ? "Large" : raw > 40 ? "Moderate" : raw > 15 ? "Small" : "Minimal";
    rawComponents.push({
      key: "drawdown",
      name: "Drawdown Risk",
      rawScore: raw,
      explanation: `${level} maximum drawdown (${metrics.maxDrawdown.maxDrawdownPercent.toFixed(1)}% peak-to-trough decline).`,
    });
  } else {
    rawComponents.push({
      key: "drawdown",
      name: "Drawdown Risk",
      rawScore: null,
      explanation: "Insufficient data to calculate maximum drawdown.",
    });
  }

  // 3. VaR
  if (metrics.var) {
    const raw = normalize(
      metrics.var.varPercent,
      NORMALIZATION.var.low,
      NORMALIZATION.var.high,
    );
    const level =
      raw > 70 ? "Elevated" : raw > 40 ? "Moderate" : raw > 15 ? "Low" : "Minimal";
    rawComponents.push({
      key: "var",
      name: "Value at Risk",
      rawScore: raw,
      explanation: `${level} daily VaR (${metrics.var.varPercent.toFixed(2)}% at ${(metrics.var.confidenceLevel * 100).toFixed(0)}% confidence).`,
    });
  } else {
    rawComponents.push({
      key: "var",
      name: "Value at Risk",
      rawScore: null,
      explanation: "Insufficient data to calculate Value at Risk.",
    });
  }

  // 4. Sharpe (inverted: lower Sharpe → higher risk)
  if (metrics.sharpe) {
    // Map Sharpe ratio inversely: high Sharpe → low risk score
    const { good, bad } = NORMALIZATION.sharpe;
    const clampedSharpe = Math.max(
      bad,
      Math.min(good, metrics.sharpe.sharpeRatio),
    );
    // Invert: good Sharpe → 0, bad Sharpe → 100
    const raw = ((good - clampedSharpe) / (good - bad)) * 100;
    const level =
      metrics.sharpe.sharpeRatio >= 1.5
        ? "Strong"
        : metrics.sharpe.sharpeRatio >= 0.5
          ? "Adequate"
          : metrics.sharpe.sharpeRatio >= 0
            ? "Weak"
            : "Negative";
    rawComponents.push({
      key: "sharpe",
      name: "Risk-Adjusted Return",
      rawScore: raw,
      explanation: `${level} risk-adjusted returns (Sharpe ratio: ${metrics.sharpe.sharpeRatio.toFixed(2)}).`,
    });
  } else {
    rawComponents.push({
      key: "sharpe",
      name: "Risk-Adjusted Return",
      rawScore: null,
      explanation: "Insufficient data to calculate Sharpe ratio.",
    });
  }

  // 5. Beta
  if (metrics.beta) {
    const deviation = Math.abs(metrics.beta.beta - 1.0);
    const raw = normalize(
      deviation,
      NORMALIZATION.beta.low,
      NORMALIZATION.beta.high,
    );
    const level =
      metrics.beta.beta > 1.5
        ? "High market sensitivity"
        : metrics.beta.beta > 1.1
          ? "Above-average market sensitivity"
          : metrics.beta.beta >= 0.8
            ? "Market-aligned sensitivity"
            : metrics.beta.beta >= 0
              ? "Below-average market sensitivity"
              : "Inverse market relationship";
    rawComponents.push({
      key: "beta",
      name: "Market Sensitivity",
      rawScore: raw,
      explanation: `${level} (β = ${metrics.beta.beta.toFixed(2)}).`,
    });
  } else {
    rawComponents.push({
      key: "beta",
      name: "Market Sensitivity",
      rawScore: null,
      explanation: "No benchmark index available. Beta cannot be calculated.",
    });
  }

  // Redistribute weights for unavailable components
  const available = rawComponents.filter((c) => c.rawScore !== null);
  const unavailable = rawComponents.filter((c) => c.rawScore === null);

  const totalAvailableBaseWeight = available.reduce(
    (sum, c) => sum + BASE_WEIGHTS[c.key],
    0,
  );

  // Build final components with redistributed weights
  const components: RiskComponent[] = rawComponents.map((c) => {
    if (c.rawScore === null) {
      return {
        name: c.name,
        rawScore: 0,
        weight: 0,
        weightedScore: 0,
        available: false,
        explanation: c.explanation,
      };
    }

    // Redistribute: proportional scaling so available weights sum to 1.0
    const adjustedWeight =
      totalAvailableBaseWeight > 0
        ? BASE_WEIGHTS[c.key] / totalAvailableBaseWeight
        : 0;

    return {
      name: c.name,
      rawScore: Number(c.rawScore.toFixed(1)),
      weight: Number(adjustedWeight.toFixed(4)),
      weightedScore: Number((c.rawScore * adjustedWeight).toFixed(2)),
      available: true,
      explanation: c.explanation,
    };
  });

  // Composite score
  const rawScore = components.reduce((sum, c) => sum + c.weightedScore, 0);
  const score = clamp100(rawScore);

  return { score, components };
}

// ───────────────────────────────────────────────────────────────────────────
// Classification
// ───────────────────────────────────────────────────────────────────────────

/**
 * Convert a numeric score to a risk classification label.
 */
export function classifyRisk(score: number): RiskClassification {
  for (const threshold of RISK_THRESHOLDS) {
    if (score <= threshold.max) return threshold.label;
  }
  return "Very High Risk";
}

// ───────────────────────────────────────────────────────────────────────────
// Deterministic Explanation Generator
// ───────────────────────────────────────────────────────────────────────────

/**
 * Generate human-readable explanations of the risk score's major contributors.
 * These are entirely deterministic — NO LLM is involved.
 */
export function generateExplanations(
  components: RiskComponent[],
  classification: RiskClassification,
): string[] {
  const explanations: string[] = [];

  // Sort available components by weighted contribution (highest first)
  const sorted = components
    .filter((c) => c.available)
    .sort((a, b) => b.weightedScore - a.weightedScore);

  // Top contributors
  const significant = sorted.filter((c) => c.rawScore > 40);
  const moderate = sorted.filter((c) => c.rawScore > 20 && c.rawScore <= 40);
  const low = sorted.filter((c) => c.rawScore <= 20);

  if (significant.length > 0) {
    explanations.push(
      `Primary risk drivers: ${significant.map((c) => c.name.toLowerCase()).join(", ")}.`,
    );
  }

  if (moderate.length > 0) {
    explanations.push(
      `Moderate contributors: ${moderate.map((c) => c.name.toLowerCase()).join(", ")}.`,
    );
  }

  if (low.length > 0 && significant.length === 0) {
    explanations.push(
      `All measured risk factors are within comfortable ranges.`,
    );
  }

  // Add specific explanations for the top 3 contributors
  for (const comp of sorted.slice(0, 3)) {
    explanations.push(comp.explanation);
  }

  // Unavailable metrics
  const unavailable = components.filter((c) => !c.available);
  if (unavailable.length > 0) {
    explanations.push(
      `Note: ${unavailable.map((c) => c.name).join(", ")} could not be calculated and ${unavailable.length === 1 ? "was" : "were"} excluded from the score.`,
    );
  }

  return explanations;
}
