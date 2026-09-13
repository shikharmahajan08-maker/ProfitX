import type { PortfolioRiskResult } from "../portfolioTypes";

export type ScenarioTransformation =
  | { type: "market_shock"; percentageDrop: number }
  | { type: "asset_shock"; symbol: string; percentageDrop: number }
  | { type: "trade_value"; symbol: string; action: "BUY" | "SELL"; amount: number }
  | { type: "trade_percentage"; symbol: string; action: "SELL"; percentage: number }
  | { type: "override_weight"; symbol: string; newWeight: number };

export interface ScenarioRequest {
  portfolioId: number;
  transformations: ScenarioTransformation[];
}

export interface ScenarioComparison {
  valueChangeAbsolute: number;
  valueChangePercentage: number;
  riskScoreChange: number;
  volatilityChange: number | null;
  maxDrawdownChange: number | null;
  concentrationChangeHHI: number;
}

export interface ScenarioResult {
  baseline: PortfolioRiskResult;
  hypothetical: PortfolioRiskResult;
  delta: ScenarioComparison;
}
