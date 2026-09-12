// ═══════════════════════════════════════════════════════════════════════════
// ProfitX Deterministic Stock Risk Engine — Type Definitions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Data frequency of the price observations.
 * Used to annualize volatility and other periodic metrics.
 */
export type DataFrequency = "daily" | "weekly" | "monthly";

/**
 * Number of trading periods per year for each frequency.
 * - Daily: 252 trading days (standard convention for Indian/US equity markets)
 * - Weekly: 52 weeks
 * - Monthly: 12 months
 */
export const TRADING_PERIODS_PER_YEAR: Record<DataFrequency, number> = {
  daily: 252,
  weekly: 52,
  monthly: 12,
};

// ───────────────────────────────────────────────────────────────────────────
// Risk Classification
// ───────────────────────────────────────────────────────────────────────────

export type RiskClassification =
  | "Very Low Risk"
  | "Low Risk"
  | "Moderate Risk"
  | "High Risk"
  | "Very High Risk";

/**
 * Centralized classification thresholds.
 * Score is inclusive on the lower bound of each range.
 */
export const RISK_THRESHOLDS: { max: number; label: RiskClassification }[] = [
  { max: 20, label: "Very Low Risk" },
  { max: 40, label: "Low Risk" },
  { max: 60, label: "Moderate Risk" },
  { max: 80, label: "High Risk" },
  { max: 100, label: "Very High Risk" },
];

// ───────────────────────────────────────────────────────────────────────────
// Metric Results
// ───────────────────────────────────────────────────────────────────────────

export interface VolatilityResult {
  periodicVolatility: number;
  annualizedVolatility: number;
  frequency: DataFrequency;
  observationCount: number;
}

export interface DrawdownResult {
  /** Maximum drawdown as a positive percentage (e.g., 30 means 30% decline). */
  maxDrawdownPercent: number;
  peakPrice: number;
  troughPrice: number;
  peakIndex: number;
  troughIndex: number;
}

export interface BetaResult {
  beta: number;
  /** Correlation between stock and benchmark returns. */
  correlation: number;
}

export interface SharpeResult {
  sharpeRatio: number;
  annualizedReturn: number;
  riskFreeRate: number;
  annualizedVolatility: number;
}

export interface SortinoResult {
  sortinoRatio: number;
  annualizedReturn: number;
  targetReturn: number;
  downsideDeviation: number;
}

export interface VaRResult {
  /** Value at Risk as a positive percentage (e.g., 2.5 means 2.5% daily loss threshold). */
  varPercent: number;
  confidenceLevel: number;
  /** The convention used: empirical percentile of historical returns. */
  method: "historical";
}

export interface CVaRResult {
  /** Conditional VaR (Expected Shortfall) as a positive percentage. */
  cvarPercent: number;
  confidenceLevel: number;
  /** Number of observations in the tail. */
  tailObservations: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Risk Metrics (all metrics collected)
// ───────────────────────────────────────────────────────────────────────────

export interface RiskMetrics {
  volatility: VolatilityResult | null;
  maxDrawdown: DrawdownResult | null;
  beta: BetaResult | null;
  sharpe: SharpeResult | null;
  sortino: SortinoResult | null;
  var: VaRResult | null;
  cvar: CVaRResult | null;
}

// ───────────────────────────────────────────────────────────────────────────
// Risk Score Components
// ───────────────────────────────────────────────────────────────────────────

export interface RiskComponent {
  name: string;
  /** Raw normalized score for this component (0–100). */
  rawScore: number;
  /** Weight applied to this component in the composite. */
  weight: number;
  /** Weighted contribution to the final score. */
  weightedScore: number;
  /** Whether this component was actually calculable. */
  available: boolean;
  /** Human-readable explanation of this component's contribution. */
  explanation: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Data Quality
// ───────────────────────────────────────────────────────────────────────────

export interface DataQuality {
  observationCount: number;
  startDate: string | null;
  endDate: string | null;
  frequency: DataFrequency;
  /** Whether the history is sufficient for reliable analysis (>=30 observations). */
  sufficientHistory: boolean;
  benchmarkAvailable: boolean;
  /** List of metrics that were unavailable and why. */
  unavailableMetrics: { metric: string; reason: string }[];
}

// ───────────────────────────────────────────────────────────────────────────
// Assumptions
// ───────────────────────────────────────────────────────────────────────────

export interface RiskAssumptions {
  riskFreeRate: number;
  riskFreeRateDescription: string;
  confidenceLevel: number;
  lookbackDays: number;
  annualizationFactor: number;
  dataSource: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Final Risk Result
// ───────────────────────────────────────────────────────────────────────────

export interface RiskResult {
  symbol: string;
  companyName: string;
  score: number;
  classification: RiskClassification;
  metrics: RiskMetrics;
  components: RiskComponent[];
  /** Deterministic text explanations of the major risk contributors. */
  explanations: string[];
  assumptions: RiskAssumptions;
  dataQuality: DataQuality;
}

// ───────────────────────────────────────────────────────────────────────────
// Engine Input
// ───────────────────────────────────────────────────────────────────────────

export interface RiskEngineInput {
  symbol: string;
  lookbackDays: number;
  confidenceLevel: number;
  riskFreeRate: number;
  benchmarkSymbol?: string;
}
