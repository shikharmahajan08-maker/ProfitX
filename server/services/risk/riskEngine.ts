// ═══════════════════════════════════════════════════════════════════════════
// ProfitX Deterministic Stock Risk Engine — Orchestration
// ═══════════════════════════════════════════════════════════════════════════
//
// This module orchestrates the complete risk analysis for a single stock.
//
// It is READ-ONLY: it never modifies portfolios, holdings, orders,
// transactions, or any financial state.
//
// Flow:
//   1. Resolve symbol → stockId from DB
//   2. Fetch historical OHLCV from market_data
//   3. Extract closing prices
//   4. Calculate all risk metrics (riskMetrics.ts)
//   5. Score and classify (riskScoring.ts)
//   6. Assemble and return RiskResult
//
// ═══════════════════════════════════════════════════════════════════════════

import { eq, desc, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { stocks, marketData } from "../../../drizzle/schema";
import {
  calculateReturns,
  calculateVolatility,
  calculateMaxDrawdown,
  calculateBeta,
  calculateSharpe,
  calculateSortino,
  calculateHistoricalVaR,
  calculateCVaR,
} from "./riskMetrics";
import {
  calculateRiskScore,
  classifyRisk,
  generateExplanations,
} from "./riskScoring";
import type {
  DataQuality,
  RiskAssumptions,
  RiskEngineInput,
  RiskMetrics,
  RiskResult,
} from "./types";
import { TRADING_PERIODS_PER_YEAR } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ───────────────────────────────────────────────────────────────────────────

/**
 * Perform a complete deterministic risk analysis for a single stock.
 *
 * @param input - Analysis parameters (symbol, lookback, confidence, etc.)
 * @returns Complete RiskResult or throws on stock-not-found / DB errors.
 */
export async function analyzeStockRisk(
  input: RiskEngineInput,
): Promise<RiskResult> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for risk analysis.");
  }

  // 1. Resolve symbol → stock record
  const stockResult = await db
    .select({
      id: stocks.id,
      symbol: stocks.symbol,
      companyName: stocks.companyName,
    })
    .from(stocks)
    .where(eq(stocks.symbol, input.symbol.toUpperCase()))
    .limit(1);

  if (stockResult.length === 0) {
    throw new Error(`Stock "${input.symbol}" not found in database.`);
  }

  const stock = stockResult[0];

  // 2. Fetch historical OHLCV data, ordered chronologically (oldest first)
  const historyRows = await db
    .select({
      timestamp: marketData.timestamp,
      close: marketData.close,
    })
    .from(marketData)
    .where(eq(marketData.stockId, stock.id))
    .orderBy(asc(marketData.timestamp))
    .limit(input.lookbackDays);

  // 3. Extract closing prices
  const closingPrices = historyRows
    .map((row) => parseFloat(row.close as string))
    .filter((p) => Number.isFinite(p) && p > 0);

  // 4. Build data quality assessment
  const dataQuality = buildDataQuality(historyRows, closingPrices, input);

  // 5. Calculate metrics
  const metrics = calculateMetrics(
    closingPrices,
    input,
    dataQuality,
  );

  // 6. Score and classify
  const { score, components } = calculateRiskScore(metrics);
  const classification = classifyRisk(score);

  // 7. Generate deterministic explanations
  const explanations = generateExplanations(components, classification);

  // 8. Assemble assumptions
  const assumptions: RiskAssumptions = {
    riskFreeRate: input.riskFreeRate,
    riskFreeRateDescription: `${(input.riskFreeRate * 100).toFixed(1)}% (approximate Indian 10-year government bond yield)`,
    confidenceLevel: input.confidenceLevel,
    lookbackDays: input.lookbackDays,
    annualizationFactor: TRADING_PERIODS_PER_YEAR.daily,
    dataSource: "ProfitX simulated market data (development mode)",
  };

  return {
    symbol: stock.symbol,
    companyName: stock.companyName,
    score,
    classification,
    metrics,
    components,
    explanations,
    assumptions,
    dataQuality,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Data Quality Builder
// ───────────────────────────────────────────────────────────────────────────

function buildDataQuality(
  historyRows: { timestamp: Date | null; close: string }[],
  closingPrices: number[],
  input: RiskEngineInput,
): DataQuality {
  const unavailableMetrics: { metric: string; reason: string }[] = [];
  const observationCount = closingPrices.length;

  let startDate: string | null = null;
  let endDate: string | null = null;

  if (historyRows.length > 0) {
    const first = historyRows[0].timestamp;
    const last = historyRows[historyRows.length - 1].timestamp;
    if (first) startDate = first.toISOString().split("T")[0];
    if (last) endDate = last.toISOString().split("T")[0];
  }

  const sufficientHistory = observationCount >= 30;

  if (observationCount < 2) {
    unavailableMetrics.push({
      metric: "All metrics",
      reason: `Only ${observationCount} price observation(s) available. At least 2 required.`,
    });
  } else if (!sufficientHistory) {
    unavailableMetrics.push({
      metric: "Reliability",
      reason: `Only ${observationCount} observations. At least 30 recommended for reliable analysis.`,
    });
  }

  // Beta is always unavailable in V1 (no benchmark)
  if (!input.benchmarkSymbol) {
    unavailableMetrics.push({
      metric: "Beta",
      reason: "No benchmark index available in the current data provider.",
    });
  }

  return {
    observationCount,
    startDate,
    endDate,
    frequency: "daily",
    sufficientHistory,
    benchmarkAvailable: false,
    unavailableMetrics,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Metric Calculator
// ───────────────────────────────────────────────────────────────────────────

function calculateMetrics(
  closingPrices: number[],
  input: RiskEngineInput,
  dataQuality: DataQuality,
): RiskMetrics {
  const emptyMetrics: RiskMetrics = {
    volatility: null,
    maxDrawdown: null,
    beta: null,
    sharpe: null,
    sortino: null,
    var: null,
    cvar: null,
  };

  if (closingPrices.length < 2) {
    return emptyMetrics;
  }

  // Calculate returns
  let returns: number[];
  try {
    returns = calculateReturns(closingPrices);
  } catch {
    return emptyMetrics;
  }

  // Calculate each metric independently; failures don't cascade
  const volatility = safeCall(() =>
    calculateVolatility(returns, "daily"),
  );

  const maxDrawdown = safeCall(() =>
    calculateMaxDrawdown(closingPrices),
  );

  const sharpe = safeCall(() =>
    calculateSharpe(returns, input.riskFreeRate, "daily"),
  );

  const sortino = safeCall(() =>
    calculateSortino(returns, input.riskFreeRate, "daily"),
  );

  const historicalVar = safeCall(() =>
    calculateHistoricalVaR(returns, input.confidenceLevel),
  );

  const cvar = safeCall(() =>
    calculateCVaR(returns, input.confidenceLevel),
  );

  // Beta: not available without a benchmark
  const beta = null;

  return {
    volatility,
    maxDrawdown,
    beta,
    sharpe,
    sortino,
    var: historicalVar,
    cvar,
  };
}

/**
 * Safely call a metric function, returning null on any error.
 * Prevents one metric failure from crashing the entire analysis.
 */
function safeCall<T>(fn: () => T | null): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
