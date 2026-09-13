// ═══════════════════════════════════════════════════════════════════════════
// ProfitX Deterministic Portfolio Risk Engine — Orchestration
// ═══════════════════════════════════════════════════════════════════════════

import { getDb } from "../../db";
import { eq, inArray, asc } from "drizzle-orm";
import { portfolios, holdings, stocks, marketData } from "../../../drizzle/schema";
import type { PortfolioRiskResult, PortfolioHolding, StressTestScenario, PortfolioSnapshot } from "./portfolioTypes";
import {
  alignReturns,
  calculatePortfolioReturns,
  reconstructPortfolioEquityCurve,
  calculateCovarianceMatrix,
  calculateCorrelationMatrix,
  calculatePortfolioVariance,
  calculateRiskContributions,
  calculateDiversificationMetrics,
} from "./portfolioRiskMetrics";
import {
  calculateVolatility,
  calculateMaxDrawdown,
  calculateSharpe,
  calculateSortino,
  calculateHistoricalVaR,
  calculateCVaR,
} from "./riskMetrics";
import { calculatePortfolioRiskScore, generatePortfolioExplanations } from "./portfolioRiskScoring";

const DEFAULT_RISK_FREE_RATE = 0.065; // 6.5% standard simulated RFR
const DEFAULT_CONFIDENCE = 0.95;

export async function getPortfolioSnapshot(userId: number): Promise<PortfolioSnapshot> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Fetch Portfolio
  const portfolioResult = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .limit(1);

  if (portfolioResult.length === 0) {
    throw new Error("Portfolio not found for user.");
  }
  const portfolio = portfolioResult[0];

  // 2. Fetch Holdings & Current Prices
  const holdingsData = await db
    .select({
      stockId: stocks.id,
      symbol: stocks.symbol,
      quantity: holdings.quantity,
      currentPrice: stocks.currentPrice,
    })
    .from(holdings)
    .innerJoin(stocks, eq(holdings.stockId, stocks.id))
    .where(eq(holdings.portfolioId, portfolio.id));

  // 3. Compute initial holdings array
  const portfolioHoldings: PortfolioHolding[] = [];
  
  for (const h of holdingsData) {
    const qty = Number(h.quantity);
    const price = Number(h.currentPrice);
    if (qty <= 0 || price <= 0) continue;
    
    portfolioHoldings.push({
      symbol: h.symbol,
      quantity: qty,
      currentPrice: price,
      marketValue: qty * price,
      weight: 0,
    });
  }

  // 4. Fetch Historical Market Data for all held stocks
  const stockIds = holdingsData.map(h => h.stockId);
  const priceHistory: Record<string, { date: string; price: number }[]> = {};

  if (stockIds.length > 0) {
    const historicalRows = await db
      .select({
        symbol: stocks.symbol,
        timestamp: marketData.timestamp,
        close: marketData.close,
      })
      .from(marketData)
      .innerJoin(stocks, eq(marketData.stockId, stocks.id))
      .where(inArray(marketData.stockId, stockIds))
      .orderBy(asc(marketData.timestamp));

    for (const row of historicalRows) {
      const symbol = row.symbol;
      if (!priceHistory[symbol]) {
        priceHistory[symbol] = [];
      }
      priceHistory[symbol].push({
        date: row.timestamp.toISOString().split("T")[0],
        price: Number(row.close),
      });
    }
  }

  return {
    portfolioId: portfolio.id,
    holdings: portfolioHoldings,
    cashBalance: Number(portfolio.cashBalance) || 0,
    priceHistory,
  };
}

export async function analyzePortfolioRisk(
  userId: number,
): Promise<PortfolioRiskResult> {
  const snapshot = await getPortfolioSnapshot(userId);

  return calculateRiskFromSnapshot(snapshot);
}

// ───────────────────────────────────────────────────────────────────────────
// Pure Risk Calculation Pipeline
// ───────────────────────────────────────────────────────────────────────────

export function calculateRiskFromSnapshot(snapshot: PortfolioSnapshot): PortfolioRiskResult {
  const { portfolioId, cashBalance, priceHistory } = snapshot;

  // Clone holdings to avoid mutating the supplied snapshot
  const clonedHoldings = snapshot.holdings.map(h => ({ ...h }));

  let totalMarketValue = 0;
  for (const h of clonedHoldings) {
    if (h.quantity > 0 && h.currentPrice > 0) {
      // Re-evaluate market value safely on the clone
      h.marketValue = h.quantity * h.currentPrice;
      totalMarketValue += h.marketValue;
    }
  }

  // Handle empty or zero-value portfolio
  if (totalMarketValue === 0 || clonedHoldings.length === 0) {
    return generateEmptyPortfolioResult(portfolioId, cashBalance);
  }

  const totalPortfolioValue = totalMarketValue + cashBalance;
  const cashWeight = cashBalance / totalPortfolioValue;
  const investedWeight = totalMarketValue / totalPortfolioValue;

  const weights: Record<string, number> = {};
  for (const ph of clonedHoldings) {
    ph.weight = ph.marketValue / totalMarketValue; // Normalized within risky asset sleeve
    weights[ph.symbol] = ph.weight;
  }

  // 5. Data Quality Checks
  const alignedData = alignReturns(priceHistory);
  const alignedSymbols = new Set(alignedData.symbols);

  const missingHoldings: string[] = [];
  for (const ph of clonedHoldings) {
    if (!alignedSymbols.has(ph.symbol)) {
      missingHoldings.push(ph.symbol);
    }
  }

  const portReturns = calculatePortfolioReturns(weights, alignedData);
  
  const hasSufficientData = missingHoldings.length === 0 && portReturns.length >= 30;

  if (!hasSufficientData) {
    return {
      portfolioId,
      totalMarketValue,
      cashBalance,
      totalPortfolioValue,
      cashWeight,
      investedWeight,
      holdings: clonedHoldings,
      score: 0,
      classification: { label: "Insufficient Data", color: "text-slate-400", hex: "#94a3b8" },
      metrics: { portfolioVolatility: null, maxDrawdown: null, sharpe: null, sortino: null, var: null, cvar: null },
      contributions: [],
      diversification: calculateDiversificationMetrics(weights),
      correlationMatrix: {},
      stressTests: [],
      components: [],
      explanations: [
        missingHoldings.length > 0 
          ? `Risk engine paused: Missing historical data for ${missingHoldings.join(", ")}.`
          : `Risk engine paused: Insufficient overlapping history (only ${portReturns.length} days). Minimum 30 days required.`
      ],
      assumptions: { riskFreeRate: DEFAULT_RISK_FREE_RATE, confidenceLevel: DEFAULT_CONFIDENCE },
      dataQuality: { 
        hasSufficientData: false, 
        isBenchmarkMissing: true, 
        missingHoldings,
        warnings: ["Insufficient overlapping data to calculate portfolio covariance."] 
      },
    };
  }

  // 6. Mathematical Metrics
  const portEquity = reconstructPortfolioEquityCurve(portReturns);
  
  const covMatrix = calculateCovarianceMatrix(alignedData);
  const corMatrix = calculateCorrelationMatrix(covMatrix, alignedData.symbols);
  const portVariance = calculatePortfolioVariance(weights, covMatrix, alignedData.symbols);
  const portVolatility = Math.sqrt(portVariance);
  const annualizedPortVolatility = portVolatility * Math.sqrt(252);
  
  const riskContributions = calculateRiskContributions(weights, covMatrix, alignedData.symbols, portVariance);
  const diversification = calculateDiversificationMetrics(weights);

  // Compute standard risk metrics on the portfolio return series
  const maxDrawdown = calculateMaxDrawdown(portEquity);
  const sharpe = calculateSharpe(portReturns, DEFAULT_RISK_FREE_RATE);
  const sortino = calculateSortino(portReturns, DEFAULT_RISK_FREE_RATE);
  const varResult = calculateHistoricalVaR(portReturns, DEFAULT_CONFIDENCE);
  const cvarResult = calculateCVaR(portReturns, DEFAULT_CONFIDENCE);

  // 6. Build Final Results
  const metrics = {
    portfolioVolatility: isFinite(annualizedPortVolatility) ? annualizedPortVolatility : null,
    maxDrawdown,
    sharpe,
    sortino,
    var: varResult,
    cvar: cvarResult,
  };

  const { score, classification, components } = calculatePortfolioRiskScore(metrics, diversification);
  const contributions = clonedHoldings.map(h => {
    const rc = riskContributions[h.symbol];
    // Calculate standalone vol for comparison
    let standaloneVol = 0;
    if (covMatrix[h.symbol]?.[h.symbol]) {
      standaloneVol = Math.sqrt(covMatrix[h.symbol][h.symbol]) * Math.sqrt(252);
    }
    return {
      symbol: h.symbol,
      weight: h.weight,
      standaloneVolatility: standaloneVol * 100,
      marginalContribution: rc?.mcr || 0,
      componentContribution: rc?.component || 0,
      percentageRiskContribution: rc?.percentage || 0,
    };
  });

  const explanations = generatePortfolioExplanations(diversification, contributions, score);

  const stressTests = generateStressTests(totalPortfolioValue, totalMarketValue, clonedHoldings);

  return {
    portfolioId,
    totalMarketValue,
    cashBalance,
    totalPortfolioValue,
    cashWeight,
    investedWeight,
    holdings: clonedHoldings,
    score,
    classification,
    metrics,
    contributions,
    diversification,
    correlationMatrix: corMatrix,
    stressTests,
    components,
    explanations,
    assumptions: {
      riskFreeRate: DEFAULT_RISK_FREE_RATE,
      confidenceLevel: DEFAULT_CONFIDENCE,
    },
    dataQuality: {
      hasSufficientData: true,
      isBenchmarkMissing: true,
      missingHoldings: [],
      warnings: [],
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

export function generateStressTests(
  totalPortfolioValue: number,
  totalMarketValue: number,
  holdings: PortfolioHolding[],
): StressTestScenario[] {
  const tests: StressTestScenario[] = [];

  // Market Shock (applied only to the invested/risky sleeve)
  const marketShockLoss = totalMarketValue * 0.10;
  tests.push({
    id: "market_shock_10",
    name: "Market Correction (-10%)",
    description: "Evaluates impact if the entire invested portfolio drops by 10%.",
    absoluteLoss: marketShockLoss,
    percentageLoss: (marketShockLoss / totalPortfolioValue) * 100,
    newPortfolioValue: totalPortfolioValue - marketShockLoss,
  });

  // Largest Holding Crash
  if (holdings.length > 0) {
    const largest = [...holdings].sort((a, b) => b.weight - a.weight)[0];
    const crashLoss = largest.marketValue * 0.50; // 50% crash of largest holding
    tests.push({
      id: "largest_crash_50",
      name: `${largest.symbol} Crash (-50%)`,
      description: `Evaluates impact if your largest holding (${largest.symbol}) drops by 50%.`,
      absoluteLoss: crashLoss,
      percentageLoss: (crashLoss / totalPortfolioValue) * 100,
      newPortfolioValue: totalPortfolioValue - crashLoss,
    });
  }

  return tests;
}

function generateEmptyPortfolioResult(portfolioId: number, cashBalance: number = 0): PortfolioRiskResult {
  return {
    portfolioId,
    totalMarketValue: 0,
    cashBalance,
    totalPortfolioValue: cashBalance,
    cashWeight: cashBalance > 0 ? 1 : 0,
    investedWeight: 0,
    holdings: [],
    score: 0,
    classification: { label: "N/A", color: "text-slate-400", hex: "#94a3b8" },
    metrics: { portfolioVolatility: null, maxDrawdown: null, sharpe: null, sortino: null, var: null, cvar: null },
    contributions: [],
    diversification: { numberOfHoldings: 0, effectiveNumberOfHoldings: 0, hhi: 0, largestHoldingWeight: 0, top3Concentration: 0, top5Concentration: 0 },
    correlationMatrix: {},
    stressTests: [],
    components: [],
    explanations: ["Portfolio is empty or holds zero market value."],
    assumptions: { riskFreeRate: 0.065, confidenceLevel: 0.95 },
    dataQuality: { hasSufficientData: false, isBenchmarkMissing: true, missingHoldings: [], warnings: ["No data available."] },
  };
}
