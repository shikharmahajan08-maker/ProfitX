/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RISK ENGINE INTERFACES — Future Architecture Boundaries
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * These interfaces define the clean boundaries for the future intelligence
 * pipeline. They are NOT implemented in V1.
 *
 * The data flow MUST always be:
 *
 *   Market Data
 *       ↓
 *   Deterministic Financial/Statistical Calculations
 *       ↓
 *   Risk Engine
 *       ↓
 *   ML Models
 *       ↓
 *   AI/LLM Explanation
 *
 * CRITICAL RULES:
 * - AI/LLM must NEVER calculate financial metrics
 * - AI/LLM must NEVER modify orders
 * - AI/LLM must NEVER invent risk scores
 * - AI/LLM must NEVER make guaranteed predictions
 * - AI/LLM must NEVER override the risk engine
 * - The quantitative engine MUST calculate all financial metrics
 * - AI/LLM may ONLY explain and synthesize verified results
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ---------------------------------------------------------------------------
// Market Data Provider (already implemented in V1)
// ---------------------------------------------------------------------------

export interface IMarketDataProvider {
  getQuote(symbol: string): Promise<MarketQuote | null>;
  getHistoricalPrices(symbol: string, range: string): Promise<PricePoint[]>;
  searchStocks(query?: string, sector?: string): Promise<MarketQuote[]>;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  timestamp: Date;
}

export interface PricePoint {
  date: string;
  price: number;
}

// ---------------------------------------------------------------------------
// Financial Calculations (deterministic, pure, testable)
// ---------------------------------------------------------------------------

export interface IFinancialCalculator {
  /** Calculate portfolio metrics from holdings and current prices */
  calculatePortfolioMetrics(holdings: HoldingInput[], prices: Map<string, number>): PortfolioMetrics;

  /** Calculate risk-adjusted returns */
  calculateSharpeRatio(returns: number[], riskFreeRate: number): number;

  /** Calculate maximum drawdown from portfolio value series */
  calculateMaxDrawdown(values: number[]): number;

  /** Calculate portfolio beta against benchmark */
  calculateBeta(portfolioReturns: number[], benchmarkReturns: number[]): number;
}

export interface HoldingInput {
  symbol: string;
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
}

export interface PortfolioMetrics {
  totalValue: number;
  investedValue: number;
  currentValue: number;
  unrealizedPnl: number;
  returnPercentage: number;
  allocation: Array<{ symbol: string; weight: number }>;
}

// ---------------------------------------------------------------------------
// Risk Engine (NOT implemented in V1)
// ---------------------------------------------------------------------------

export interface IRiskEngine {
  /** Calculate Value at Risk */
  calculateVaR(portfolio: PortfolioMetrics, confidence: number, horizon: number): VaRResult;

  /** Calculate Conditional VaR (Expected Shortfall) */
  calculateCVaR(portfolio: PortfolioMetrics, confidence: number): number;

  /** Run Monte Carlo simulation */
  runMonteCarloSimulation(portfolio: PortfolioMetrics, simulations: number, horizon: number): SimulationResult;

  /** Stress test against historical scenarios */
  stressTest(portfolio: PortfolioMetrics, scenario: StressScenario): StressTestResult;

  /** Calculate risk contribution per holding */
  calculateRiskContribution(portfolio: PortfolioMetrics): Array<{ symbol: string; contribution: number }>;
}

export interface VaRResult {
  value: number;
  confidence: number;
  horizon: number;
  method: "historical" | "parametric" | "monte-carlo";
}

export interface SimulationResult {
  paths: number[][];
  percentiles: Record<number, number>;
  expectedValue: number;
}

export interface StressScenario {
  name: string;
  sectorShocks: Record<string, number>;
}

export interface StressTestResult {
  scenario: string;
  portfolioImpact: number;
  holdingImpacts: Array<{ symbol: string; impact: number }>;
}

// ---------------------------------------------------------------------------
// ML Models (NOT implemented in V1)
// ---------------------------------------------------------------------------

export interface IMLModel {
  /** Predict risk score for a portfolio */
  predictRiskScore(portfolio: PortfolioMetrics): Promise<RiskPrediction>;

  /** Analyze trading behavior patterns */
  analyzeTradingBehavior(trades: TradeInput[]): Promise<BehaviorAnalysis>;

  /** Sentiment analysis from news */
  analyzeSentiment(newsItems: NewsInput[]): Promise<SentimentResult>;
}

export interface RiskPrediction {
  score: number;       // 0-100
  confidence: number;  // 0-1
  factors: string[];
  timestamp: Date;
}

export interface TradeInput {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  timestamp: Date;
}

export interface BehaviorAnalysis {
  patterns: string[];
  riskTendency: "conservative" | "moderate" | "aggressive";
  diversificationScore: number;
}

export interface NewsInput {
  title: string;
  description: string;
  source: string;
  sector: string;
}

export interface SentimentResult {
  overall: "positive" | "neutral" | "negative";
  score: number;  // -1 to 1
  sectors: Record<string, number>;
}

// ---------------------------------------------------------------------------
// AI Explanation Layer (NOT implemented in V1)
// ---------------------------------------------------------------------------

export interface IAIExplainer {
  /**
   * Explain verified results from the risk engine and ML models.
   * The AI MUST NOT calculate any metrics — it receives pre-computed results only.
   */
  explainPortfolioRisk(
    metrics: PortfolioMetrics,
    riskResult: VaRResult,
    prediction: RiskPrediction,
  ): Promise<string>;

  /** Generate a trade post-mortem explanation */
  explainTradeOutcome(
    trade: TradeInput,
    currentPrice: number,
    pnl: number,
  ): Promise<string>;

  /** Summarize market conditions for a sector */
  summarizeMarketConditions(
    sentiment: SentimentResult,
    sectorReturns: Record<string, number>,
  ): Promise<string>;
}
