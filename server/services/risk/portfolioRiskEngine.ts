// ═══════════════════════════════════════════════════════════════════════════
// ProfitX Deterministic Portfolio Risk Engine — Orchestration
// ═══════════════════════════════════════════════════════════════════════════

import { getDb } from "../../db";
import { eq, inArray, asc } from "drizzle-orm";
import { portfolios, holdings, stocks, marketData } from "../../../drizzle/schema";
import type { PortfolioRiskResult, PortfolioHolding, StressTestScenario } from "./portfolioTypes";
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

export async function analyzePortfolioRisk(
  userId: number,
): Promise<PortfolioRiskResult> {
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

  // 3. Compute Weights
  let totalMarketValue = 0;
  const portfolioHoldings: PortfolioHolding[] = [];
  
  for (const h of holdingsData) {
    const qty = Number(h.quantity);
    const price = Number(h.currentPrice);
    if (qty <= 0 || price <= 0) continue;
    
    const mv = qty * price;
    totalMarketValue += mv;
    
    portfolioHoldings.push({
      symbol: h.symbol,
      quantity: qty,
      currentPrice: price,
      marketValue: mv,
      weight: 0, // Assigned below
    });
  }

  // Handle empty or zero-value portfolio
  if (totalMarketValue === 0 || portfolioHoldings.length === 0) {
    return generateEmptyPortfolioResult(portfolio.id, Number(portfolio.cashBalance) || 0);
  }

  const cashBalance = Number(portfolio.cashBalance) || 0;
  const totalPortfolioValue = totalMarketValue + cashBalance;
  const cashWeight = cashBalance / totalPortfolioValue;
  const investedWeight = totalMarketValue / totalPortfolioValue;

  const weights: Record<string, number> = {};
  for (const ph of portfolioHoldings) {
    ph.weight = ph.marketValue / totalMarketValue; // Normalized within risky asset sleeve
    weights[ph.symbol] = ph.weight;
  }

  // 4. Fetch Historical Market Data for all held stocks
  const stockIds = holdingsData.map(h => h.stockId);
  const history = await db
    .select({
      stockId: marketData.stockId,
      timestamp: marketData.timestamp,
      close: marketData.close,
    })
    .from(marketData)
    .where(inArray(marketData.stockId, stockIds))
    .orderBy(asc(marketData.timestamp));

  // Map stockId -> symbol for grouping
  const idToSymbol: Record<number, string> = {};
  for (const h of holdingsData) {
    idToSymbol[h.stockId] = h.symbol;
  }

  const priceHistory: Record<string, { date: string; price: number }[]> = {};
  for (const row of history) {
    const symbol = idToSymbol[row.stockId];
    if (!priceHistory[symbol]) priceHistory[symbol] = [];
    priceHistory[symbol].push({
      date: row.timestamp.toISOString().split("T")[0],
      price: Number(row.close),
    });
  }

  // 5. Data Quality Checks
  const alignedData = alignReturns(priceHistory);
  const alignedSymbols = new Set(alignedData.symbols);

  const missingHoldings: string[] = [];
  for (const ph of portfolioHoldings) {
    if (!alignedSymbols.has(ph.symbol)) {
      missingHoldings.push(ph.symbol);
    }
  }

  const portReturns = calculatePortfolioReturns(weights, alignedData);
  
  const hasSufficientData = missingHoldings.length === 0 && portReturns.length >= 30;

  if (!hasSufficientData) {
    return {
      portfolioId: portfolio.id,
      totalMarketValue,
      cashBalance,
      totalPortfolioValue,
      cashWeight,
      investedWeight,
      holdings: portfolioHoldings,
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
  // Map risk contributions back to array form
  const contributions = portfolioHoldings.map(h => {
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

  // 7. Stress Testing (Deterministic Scenarios)
  const stressTests = generateStressTests(totalPortfolioValue, totalMarketValue, portfolioHoldings);

  return {
    portfolioId: portfolio.id,
    totalMarketValue,
    cashBalance,
    totalPortfolioValue,
    cashWeight,
    investedWeight,
    holdings: portfolioHoldings,
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
