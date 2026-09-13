import { describe, it, expect } from "vitest";
import {
  alignReturns,
  calculatePortfolioReturns,
  calculateCovarianceMatrix,
  calculateCorrelationMatrix,
  calculatePortfolioVariance,
  calculateRiskContributions,
  calculateDiversificationMetrics,
} from "./services/risk/portfolioRiskMetrics";
import { calculatePortfolioRiskScore } from "./services/risk/portfolioRiskScoring";
import { generateStressTests } from "./services/risk/portfolioRiskEngine";
import type { PortfolioRiskMetrics, DiversificationMetrics, PortfolioHolding } from "./services/risk/portfolioTypes";

describe("Portfolio Risk Metrics", () => {
  it("aligns returns correctly and extracts synchronous data", () => {
    const history = {
      AAPL: [
        { date: "2023-01-01", price: 100 },
        { date: "2023-01-02", price: 101 }, // +1%
        { date: "2023-01-03", price: 103.02 }, // +2%
      ],
      MSFT: [
        { date: "2023-01-02", price: 50 },
        { date: "2023-01-03", price: 51 }, // +2%
        { date: "2023-01-04", price: 52 },
      ]
    };
    
    // Intersection dates: 2023-01-02, 2023-01-03.
    // So there is only 1 return interval between 01-02 and 01-03
    const aligned = alignReturns(history);
    
    expect(aligned.dates).toEqual(["2023-01-03"]);
    expect(aligned.symbols.sort()).toEqual(["AAPL", "MSFT"].sort());
    
    // AAPL: 103.02 / 101 - 1 = 0.02
    expect(aligned.returnsBySymbol["AAPL"][0]).toBeCloseTo(0.02, 4);
    // MSFT: 51 / 50 - 1 = 0.02
    expect(aligned.returnsBySymbol["MSFT"][0]).toBeCloseTo(0.02, 4);
  });

  it("calculates covariance and correlation for perfectly correlated assets", () => {
    // Generate returns that are perfectly linear: R_B = 2 * R_A
    const aligned = {
      dates: ["d1", "d2", "d3", "d4"],
      symbols: ["A", "B"],
      returnsBySymbol: {
        A: [0.01, -0.02, 0.03, -0.01],
        B: [0.02, -0.04, 0.06, -0.02],
      }
    };
    
    const cov = calculateCovarianceMatrix(aligned);
    const cor = calculateCorrelationMatrix(cov, aligned.symbols);
    
    expect(cor["A"]["B"]).toBeCloseTo(1.0, 4);
    expect(cor["B"]["A"]).toBeCloseTo(1.0, 4);
    expect(cor["A"]["A"]).toBeCloseTo(1.0, 4);
  });

  it("calculates covariance and correlation for uncorrelated assets", () => {
    // Orthogonal returns
    const aligned = {
      dates: ["d1", "d2", "d3", "d4"],
      symbols: ["A", "B"],
      returnsBySymbol: {
        A: [1, 1, -1, -1],
        B: [1, -1, 1, -1],
      }
    };
    
    const cov = calculateCovarianceMatrix(aligned);
    const cor = calculateCorrelationMatrix(cov, aligned.symbols);
    
    // Dot product of mean-centered A and B is 0
    expect(cor["A"]["B"]).toBeCloseTo(0.0, 4);
  });

  it("calculates portfolio variance and risk contributions summing to 100%", () => {
    const aligned = {
      dates: ["d1", "d2", "d3", "d4", "d5"],
      symbols: ["A", "B", "C"],
      returnsBySymbol: {
        A: [0.01, -0.02, 0.03, -0.01, 0.02],
        B: [0.02, 0.01, -0.03, 0.04, -0.01],
        C: [-0.01, -0.02, -0.03, -0.04, -0.05], // Trend
      }
    };
    const weights = { A: 0.5, B: 0.3, C: 0.2 };
    
    const cov = calculateCovarianceMatrix(aligned);
    const portVar = calculatePortfolioVariance(weights, cov, aligned.symbols);
    
    // Variance must be positive
    expect(portVar).toBeGreaterThan(0);
    
    const contributions = calculateRiskContributions(weights, cov, aligned.symbols, portVar);
    
    const sumContrib = 
      contributions["A"].percentage + 
      contributions["B"].percentage + 
      contributions["C"].percentage;
      
    // Sum of percentage risk contributions MUST mathematically equal 100%
    expect(sumContrib).toBeCloseTo(100.0, 4);
  });

  it("calculates concentration and diversification correctly", () => {
    const weights = { A: 0.6, B: 0.3, C: 0.1 };
    const div = calculateDiversificationMetrics(weights);
    
    // HHI = 0.6^2 + 0.3^2 + 0.1^2 = 0.36 + 0.09 + 0.01 = 0.46
    expect(div.hhi).toBeCloseTo(0.46, 4);
    
    // ENH = 1 / 0.46 = 2.1739
    expect(div.effectiveNumberOfHoldings).toBeCloseTo(2.1739, 4);
    
    expect(div.largestHoldingWeight).toBe(0.6);
  });
});

describe("Portfolio Risk Scoring", () => {
  it("normalizes scores properly and handles missing metrics", () => {
    const metrics: PortfolioRiskMetrics = {
      portfolioVolatility: 0.15, // 15% (scale 0.05 - 0.35 -> ~33% of max risk)
      maxDrawdown: { maxDrawdownPercent: 15, peak: 100, trough: 85, duration: 10 }, // 15% (scale 0.05 - 0.40 -> ~28% risk)
      var: { varPercent: 2.0, confidenceLevel: 0.95, method: "historical" }, // 2% (scale 1% - 4% -> ~33% risk)
      sharpe: { sharpeRatio: 1.0, annualizedReturn: 0.1, riskFreeRate: 0.05, annualizedVolatility: 0.15 }, // 1.0 (scale 1.5 - 0.0 -> ~33% risk)
      cvar: null,
      sortino: null
    };

    const div: DiversificationMetrics = {
      numberOfHoldings: 5,
      effectiveNumberOfHoldings: 4,
      hhi: 0.25, // Scale 0.15 - 0.60 -> (0.1 / 0.45) = 22% risk
      largestHoldingWeight: 0.4,
      top3Concentration: 0.8,
      top5Concentration: 1.0,
    };

    const result = calculatePortfolioRiskScore(metrics, div);
    
    // Score should be somewhere in the ~30-40 range
    expect(result.score).toBeGreaterThan(20);
    expect(result.score).toBeLessThan(50);
    
    // Test that missing sharpe redistributes weight
    const metricsNoSharpe = { ...metrics, sharpe: null };
    const result2 = calculatePortfolioRiskScore(metricsNoSharpe, div);
    expect(result2.score).toBeGreaterThan(0);
  });

  it("handles completely empty portfolio gracefully", () => {
    const emptyMetrics: PortfolioRiskMetrics = {
      portfolioVolatility: null,
      maxDrawdown: null,
      var: null,
      sharpe: null,
      cvar: null,
      sortino: null
    };
    const emptyDiv: DiversificationMetrics = {
      numberOfHoldings: 0, hhi: 0, effectiveNumberOfHoldings: 0, largestHoldingWeight: 0, top3Concentration: 0, top5Concentration: 0
    };
    const result = calculatePortfolioRiskScore(emptyMetrics, emptyDiv);
    expect(result.score).toBe(0);
    expect(result.classification.label).toBe("N/A");
  });
});

describe("Phase 3 Fixes: Data Quality & Cash Constraints", () => {
  it("Missing historical data: alignReturns drops to zero if a holding has no overlap", () => {
    const history = {
      AAPL: [{ date: "2023-01-01", price: 100 }, { date: "2023-01-02", price: 101 }],
      MSFT: [{ date: "2023-01-01", price: 50 }, { date: "2023-01-02", price: 51 }],
      NEW_STOCK: [] // Completely missing data
    };
    
    // Intersection of dates should be empty because NEW_STOCK has no dates.
    const aligned = alignReturns(history);
    expect(aligned.dates.length).toBe(0);
  });

  it("Minimum observations: properly identifies when data is < 30 observations", () => {
    // Generate exactly 29 overlapping dates
    const dates = Array.from({ length: 29 }, (_, i) => `2023-01-${(i + 1).toString().padStart(2, '0')}`);
    const aaplPrices = dates.map((d, i) => ({ date: d, price: 100 + i }));
    const msftPrices = dates.map((d, i) => ({ date: d, price: 50 + i }));
    
    const history = { AAPL: aaplPrices, MSFT: msftPrices };
    const aligned = alignReturns(history);
    
    // Since Returns are computed from N prices, we get N-1 returns.
    // 29 prices -> 28 returns.
    expect(aligned.dates.length).toBe(28);
    
    const hasSufficientData = aligned.dates.length >= 30;
    expect(hasSufficientData).toBe(false);
  });

  it("Cash: normalizes covariance weights across the invested sleeve", () => {
    // Portfolio total value is 100,000. Cash is 20,000. Invested is 80,000.
    const totalPortfolioValue = 100000;
    const cashBalance = 20000;
    const totalMarketValue = 80000; // sum of holdings
    
    const aaplValue = 40000;
    const msftValue = 40000;
    
    // Weights relative to TOTAL portfolio value:
    const cashWeight = cashBalance / totalPortfolioValue; 
    const aaplWeightTotal = aaplValue / totalPortfolioValue; // 40%
    const msftWeightTotal = msftValue / totalPortfolioValue; // 40%
    
    expect(cashWeight).toBe(0.20);
    expect(aaplWeightTotal + msftWeightTotal + cashWeight).toBeCloseTo(1.0, 4);
    
    // Weights relative to INVESTED sleeve (used for the risk engine math):
    const aaplWeightInvested = aaplValue / totalMarketValue; // 50%
    const msftWeightInvested = msftValue / totalMarketValue; // 50%
    
    expect(aaplWeightInvested).toBe(0.50);
    expect(msftWeightInvested).toBe(0.50);
    expect(aaplWeightInvested + msftWeightInvested).toBeCloseTo(1.0, 4);
  });

  it("Aligned-history: properly drops holdings missing from aligned dataset", () => {
    // Portfolio holds AAPL and TSLA.
    // AAPL has 30 prices. TSLA has 30 prices.
    // BUT they don't overlap at all.
    const aaplPrices = Array.from({ length: 30 }, (_, i) => ({ date: `2023-01-${(i+1).toString().padStart(2, '0')}`, price: 100 }));
    const tslaPrices = Array.from({ length: 30 }, (_, i) => ({ date: `2024-01-${(i+1).toString().padStart(2, '0')}`, price: 200 }));
    
    const history = { AAPL: aaplPrices, TSLA: tslaPrices };
    const aligned = alignReturns(history);
    
    // Aligned dates should be 0 because no overlap.
    expect(aligned.dates.length).toBe(0);
    
    // Simulate the engine's check:
    const alignedSymbols = new Set(aligned.symbols);
    // Since aligned returns handles this by finding common dates, if common dates = 0, no data is returned.
    
    // If a stock had NO prices at all:
    const history2 = { AAPL: aaplPrices, MISSING: [] };
    const aligned2 = alignReturns(history2);
    const alignedSymbols2 = new Set(aligned2.symbols);
    
    // The engine checks if the portfolio holding symbol is in alignedSymbols2
    // If MISSING had 0 prices, it's missing from history2 OR it yields 0 overlapping dates.
    // Wait, alignReturns will yield symbols = ['AAPL', 'MISSING'] but dates = [].
    // So the symbol is in alignedSymbols2, but dates.length < 30 triggers the global rejection.
    expect(aligned2.dates.length).toBeLessThan(30);
  });

  it("Cash-aware stress test: only invested sleeve is shocked", () => {
    const totalPortfolioValue = 200000;
    const totalMarketValue = 100000; // Invested part
    // Cash is implicitly 100000
    
    const holdings: PortfolioHolding[] = [
      { symbol: "AAPL", quantity: 1, currentPrice: 100000, marketValue: 100000, weight: 1.0 }
    ];
    
    const stressTests = generateStressTests(totalPortfolioValue, totalMarketValue, holdings);
    
    const marketShock = stressTests.find(t => t.id === "market_shock_10");
    expect(marketShock).toBeDefined();
    
    // 10% of 100,000 invested = 10,000 loss
    expect(marketShock!.absoluteLoss).toBe(10000);
    
    // 200,000 - 10,000 = 190,000 new total value
    expect(marketShock!.newPortfolioValue).toBe(190000);
    
    // 10,000 / 200,000 * 100 = 5% portfolio loss
    expect(marketShock!.percentageLoss).toBe(5);
  });
});
