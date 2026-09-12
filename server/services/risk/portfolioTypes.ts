// ═══════════════════════════════════════════════════════════════════════════
// ProfitX Deterministic Portfolio Risk Engine — Type Definitions
// ═══════════════════════════════════════════════════════════════════════════

import type {
  SharpeResult,
  SortinoResult,
  VaRResult,
  CVaRResult,
  DrawdownResult,
} from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Core Definitions
// ───────────────────────────────────────────────────────────────────────────

export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  currentPrice: number;
  marketValue: number;
  weight: number;
}

export interface PortfolioRiskComponent {
  label: string;
  value: number;
  score: number;
  weight: number;
}

export interface PortfolioDataQuality {
  hasSufficientData: boolean;
  isBenchmarkMissing: boolean;
  warnings: string[];
  missingHoldings: string[];
}

export interface PortfolioRiskAssumptions {
  riskFreeRate: number;
  confidenceLevel: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Risk Contributions
// ───────────────────────────────────────────────────────────────────────────

export interface RiskContribution {
  symbol: string;
  weight: number;
  /** Standalone annualized volatility of this stock (percentage). */
  standaloneVolatility: number;
  /** Marginal Contribution to Risk (MCR). */
  marginalContribution: number;
  /** Component Contribution (weight * MCR). */
  componentContribution: number;
  /** Percentage of total portfolio risk contributed by this stock (0-100). */
  percentageRiskContribution: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Diversification Metrics
// ───────────────────────────────────────────────────────────────────────────

export interface DiversificationMetrics {
  numberOfHoldings: number;
  /** Effective Number of Holdings (ENH = 1 / HHI). */
  effectiveNumberOfHoldings: number;
  /** Herfindahl-Hirschman Index (sum of squared weights). */
  hhi: number;
  largestHoldingWeight: number;
  top3Concentration: number;
  top5Concentration: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Portfolio Risk Metrics
// ───────────────────────────────────────────────────────────────────────────

export interface PortfolioRiskMetrics {
  /** Total portfolio annualized volatility (calculated from covariance matrix). */
  portfolioVolatility: number | null;
  /** Max drawdown evaluated on the historical portfolio price path. */
  maxDrawdown: DrawdownResult | null;
  sharpe: SharpeResult | null;
  sortino: SortinoResult | null;
  var: VaRResult | null;
  cvar: CVaRResult | null;
}

// ───────────────────────────────────────────────────────────────────────────
// Stress Testing
// ───────────────────────────────────────────────────────────────────────────

export interface StressTestScenario {
  id: string;
  name: string;
  description: string;
  absoluteLoss: number;
  percentageLoss: number;
  newPortfolioValue: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Final Portfolio Risk Result
// ───────────────────────────────────────────────────────────────────────────

export interface PortfolioRiskResult {
  portfolioId: number;
  totalMarketValue: number; // Value of all risky assets (invested)
  cashBalance: number;
  totalPortfolioValue: number; // cashBalance + totalMarketValue
  cashWeight: number;
  investedWeight: number;
  holdings: PortfolioHolding[];
  
  score: number;
  classification: { label: string; color: string; hex: string };
  
  metrics: PortfolioRiskMetrics;
  contributions: RiskContribution[];
  diversification: DiversificationMetrics;
  correlationMatrix: Record<string, Record<string, number>>;
  
  stressTests: StressTestScenario[];
  components: PortfolioRiskComponent[];
  explanations: string[];
  
  assumptions: PortfolioRiskAssumptions;
  dataQuality: PortfolioDataQuality;
}
