// ═══════════════════════════════════════════════════════════════════════════
// ProfitX Deterministic Portfolio Risk Engine — Scoring Rules
// ═══════════════════════════════════════════════════════════════════════════

import type { PortfolioRiskMetrics, DiversificationMetrics, RiskContribution, PortfolioRiskComponent } from "./portfolioTypes";

// ───────────────────────────────────────────────────────────────────────────
// Heuristic Thresholds (ProfitX specific)
// ───────────────────────────────────────────────────────────────────────────

const PORTFOLIO_NORMALIZATION = {
  // Diversified portfolios generally have lower volatility than single stocks.
  // 5% is very low, 35% is exceptionally high for a portfolio.
  volatility: { min: 0.05, max: 0.35, weight: 35 },
  
  // Drawdowns: 5% is noise, 40% is severe.
  drawdown: { min: 0.05, max: 0.40, weight: 25 },
  
  // Historical VaR: 1% daily loss is mild, 4% daily loss is extreme.
  var: { min: 0.01, max: 0.04, weight: 20 },
  
  // Sharpe Ratio: 1.5+ is excellent, <0 is terrible.
  sharpe: { good: 1.5, bad: 0.0, weight: 10 },
  
  // Concentration (HHI): 1.0 is 100% concentrated, 0.1 is 10 equal-weight.
  // We penalize high concentration.
  concentration: { low: 0.15, high: 0.60, weight: 10 },
};

// ───────────────────────────────────────────────────────────────────────────
// Scoring Engine
// ───────────────────────────────────────────────────────────────────────────

export function calculatePortfolioRiskScore(
  metrics: PortfolioRiskMetrics,
  diversification: DiversificationMetrics,
): { score: number; classification: { label: string; color: string; hex: string }; components: PortfolioRiskComponent[] } {
  
  // Start with 100 points of available weight.
  // If a metric is null, its weight is removed and remaining weights scale up.
  const baseWeights = {
    volatility: PORTFOLIO_NORMALIZATION.volatility.weight,
    drawdown: PORTFOLIO_NORMALIZATION.drawdown.weight,
    var: PORTFOLIO_NORMALIZATION.var.weight,
    sharpe: PORTFOLIO_NORMALIZATION.sharpe.weight,
    concentration: PORTFOLIO_NORMALIZATION.concentration.weight,
  };

  const components: PortfolioRiskComponent[] = [];
  let availableWeight = 0;
  
  if (metrics.portfolioVolatility !== null) availableWeight += baseWeights.volatility;
  if (metrics.maxDrawdown !== null) availableWeight += baseWeights.drawdown;
  if (metrics.var !== null) availableWeight += baseWeights.var;
  if (metrics.sharpe !== null) availableWeight += baseWeights.sharpe;
  if (diversification.hhi > 0) availableWeight += baseWeights.concentration;

  // Fallback for completely empty/invalid portfolios
  if (availableWeight === 0) {
    return {
      score: 0,
      classification: { label: "N/A", color: "text-slate-400", hex: "#94a3b8" },
      components: [],
    };
  }

  let finalScore = 0;

  // 1. Volatility (Higher = Riskier)
  if (metrics.portfolioVolatility !== null) {
    const { min, max } = PORTFOLIO_NORMALIZATION.volatility;
    const clamped = Math.max(min, Math.min(max, metrics.portfolioVolatility));
    const score0to100 = ((clamped - min) / (max - min)) * 100;
    const adjustedWeight = baseWeights.volatility / availableWeight;
    finalScore += score0to100 * adjustedWeight;
    components.push({ label: "Portfolio Volatility", value: metrics.portfolioVolatility, score: score0to100, weight: adjustedWeight * 100 });
  }

  // 2. Drawdown (Higher = Riskier)
  if (metrics.maxDrawdown !== null) {
    const { min, max } = PORTFOLIO_NORMALIZATION.drawdown;
    const dd = metrics.maxDrawdown.maxDrawdownPercent / 100;
    const clamped = Math.max(min, Math.min(max, dd));
    const score0to100 = ((clamped - min) / (max - min)) * 100;
    const adjustedWeight = baseWeights.drawdown / availableWeight;
    finalScore += score0to100 * adjustedWeight;
    components.push({ label: "Max Drawdown", value: dd, score: score0to100, weight: adjustedWeight * 100 });
  }

  // 3. VaR (Higher = Riskier)
  if (metrics.var !== null) {
    const { min, max } = PORTFOLIO_NORMALIZATION.var;
    const v = metrics.var.varPercent / 100;
    const clamped = Math.max(min, Math.min(max, v));
    const score0to100 = ((clamped - min) / (max - min)) * 100;
    const adjustedWeight = baseWeights.var / availableWeight;
    finalScore += score0to100 * adjustedWeight;
    components.push({ label: "Value at Risk", value: v, score: score0to100, weight: adjustedWeight * 100 });
  }

  // 4. Sharpe (Higher = SAFER) -> Invert
  if (metrics.sharpe !== null) {
    const { good, bad } = PORTFOLIO_NORMALIZATION.sharpe;
    const s = metrics.sharpe.sharpeRatio;
    const clamped = Math.min(good, Math.max(bad, s));
    const score0to100 = ((good - clamped) / (good - bad)) * 100;
    const adjustedWeight = baseWeights.sharpe / availableWeight;
    finalScore += score0to100 * adjustedWeight;
    components.push({ label: "Sharpe Ratio", value: s, score: score0to100, weight: adjustedWeight * 100 });
  }

  // 5. Concentration (Higher HHI = Riskier)
  if (diversification.hhi > 0) {
    const { low, high } = PORTFOLIO_NORMALIZATION.concentration;
    const h = diversification.hhi;
    const clamped = Math.max(low, Math.min(high, h));
    const score0to100 = ((clamped - low) / (high - low)) * 100;
    const adjustedWeight = baseWeights.concentration / availableWeight;
    finalScore += score0to100 * adjustedWeight;
    components.push({ label: "Concentration (HHI)", value: h, score: score0to100, weight: adjustedWeight * 100 });
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(finalScore)));

  return {
    score: boundedScore,
    classification: getPortfolioRiskClassification(boundedScore),
    components,
  };
}

function getPortfolioRiskClassification(score: number): { label: string; color: string; hex: string } {
  if (score <= 20) return { label: "Very Low Risk", color: "text-emerald-500", hex: "#10b981" };
  if (score <= 40) return { label: "Low Risk", color: "text-emerald-400", hex: "#34d399" };
  if (score <= 60) return { label: "Moderate Risk", color: "text-amber-500", hex: "#f59e0b" };
  if (score <= 80) return { label: "High Risk", color: "text-orange-500", hex: "#f97316" };
  return { label: "Very High Risk", color: "text-rose-600", hex: "#e11d48" };
}

// ───────────────────────────────────────────────────────────────────────────
// Explanations (Deterministic text generation)
// ───────────────────────────────────────────────────────────────────────────

export function generatePortfolioExplanations(
  diversification: DiversificationMetrics,
  contributions: RiskContribution[],
  score: number,
): string[] {
  const explanations: string[] = [];

  // Concentration explanation
  if (diversification.numberOfHoldings === 1) {
    explanations.push("Portfolio is 100% concentrated in a single asset, offering no diversification benefits.");
  } else {
    if (diversification.hhi > 0.5) {
      explanations.push("Portfolio concentration is high, heavily relying on the performance of a few top holdings.");
    } else if (diversification.hhi < 0.15) {
      explanations.push("Portfolio is well-diversified across multiple assets, reducing idiosyncratic (single-stock) risk.");
    }
  }

  // Risk Contribution explanation
  if (contributions.length > 0) {
    const sortedContributors = [...contributions].sort((a, b) => b.percentageRiskContribution - a.percentageRiskContribution);
    const topContributor = sortedContributors[0];
    
    if (topContributor.percentageRiskContribution > 40 && diversification.numberOfHoldings > 2) {
      explanations.push(`Risk is disproportionately driven by ${topContributor.symbol}, which contributes ${topContributor.percentageRiskContribution.toFixed(1)}% of total portfolio volatility.`);
    }

    // Identify hidden risks (low weight, high risk contribution)
    const hiddenRisk = sortedContributors.find(c => c.percentageRiskContribution > c.weight * 100 * 1.5 && c.weight > 0.05);
    if (hiddenRisk) {
      explanations.push(`${hiddenRisk.symbol} introduces disproportionate risk relative to its allocation due to high standalone volatility and correlation.`);
    }
  }

  return explanations;
}
