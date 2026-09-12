// ═══════════════════════════════════════════════════════════════════════════
// ProfitX Risk Engine — Unit Tests
// ═══════════════════════════════════════════════════════════════════════════
//
// All expected values are HAND-CALCULATED or derived from known formulas.
// This file does NOT mock the database — it tests pure math functions.
//
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  calculateReturns,
  calculateVolatility,
  calculateMaxDrawdown,
  calculateBeta,
  calculateSharpe,
  calculateSortino,
  calculateHistoricalVaR,
  calculateCVaR,
  annualizeReturn,
  validatePrices,
} from "./services/risk/riskMetrics";
import {
  calculateRiskScore,
  classifyRisk,
  generateExplanations,
} from "./services/risk/riskScoring";
import type { RiskMetrics } from "./services/risk/types";

// ───────────────────────────────────────────────────────────────────────────
// 1. Simple Returns
// ───────────────────────────────────────────────────────────────────────────

describe("calculateReturns", () => {
  it("calculates simple returns from prices", () => {
    // Prices: 100, 110, 99, 108
    // Returns: (110/100)-1 = 0.10, (99/110)-1 = -0.1, (108/99)-1 = 0.090909...
    const prices = [100, 110, 99, 108];
    const returns = calculateReturns(prices);

    expect(returns).toHaveLength(3);
    expect(returns[0]).toBeCloseTo(0.1, 10);
    expect(returns[1]).toBeCloseTo(-0.1, 10);
    expect(returns[2]).toBeCloseTo(108 / 99 - 1, 10);
  });

  it("handles two prices", () => {
    const returns = calculateReturns([50, 75]);
    expect(returns).toHaveLength(1);
    expect(returns[0]).toBeCloseTo(0.5, 10); // 50% gain
  });

  it("throws on fewer than 2 prices", () => {
    expect(() => calculateReturns([100])).toThrow("At least 2");
    expect(() => calculateReturns([])).toThrow("At least 2");
  });

  it("throws on negative prices", () => {
    expect(() => calculateReturns([100, -50, 80])).toThrow("Invalid price");
  });

  it("throws on zero prices", () => {
    expect(() => calculateReturns([100, 0, 80])).toThrow("Invalid price");
  });

  it("throws on NaN prices", () => {
    expect(() => calculateReturns([100, NaN, 80])).toThrow("Invalid price");
  });

  it("throws on Infinity prices", () => {
    expect(() => calculateReturns([100, Infinity, 80])).toThrow("Invalid price");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2. Volatility
// ───────────────────────────────────────────────────────────────────────────

describe("calculateVolatility", () => {
  it("calculates sample standard deviation of returns", () => {
    // Returns: 0.10, -0.10, 0.090909...
    // Mean = (0.10 + (-0.10) + 0.090909...) / 3 = 0.030303...
    // Variance = Σ(R - mean)^2 / (n-1) = ... / 2
    const returns = calculateReturns([100, 110, 99, 108]);
    const vol = calculateVolatility(returns, "daily");

    expect(vol).not.toBeNull();
    expect(vol!.periodicVolatility).toBeGreaterThan(0);
    expect(vol!.annualizedVolatility).toBeGreaterThan(vol!.periodicVolatility);
    expect(vol!.frequency).toBe("daily");
    expect(vol!.observationCount).toBe(3);

    // Annualized = periodic × sqrt(252)
    expect(vol!.annualizedVolatility).toBeCloseTo(
      vol!.periodicVolatility * Math.sqrt(252),
      10,
    );
  });

  it("returns null for fewer than 2 returns", () => {
    expect(calculateVolatility([0.05])).toBeNull();
    expect(calculateVolatility([])).toBeNull();
  });

  it("handles zero volatility (flat returns)", () => {
    // All returns are 0 → stddev = 0
    const vol = calculateVolatility([0, 0, 0, 0, 0]);
    expect(vol).not.toBeNull();
    expect(vol!.periodicVolatility).toBe(0);
    expect(vol!.annualizedVolatility).toBe(0);
  });

  it("annualizes correctly for weekly frequency", () => {
    const returns = [0.02, -0.01, 0.015, 0.005, -0.008];
    const vol = calculateVolatility(returns, "weekly");
    expect(vol).not.toBeNull();
    expect(vol!.annualizedVolatility).toBeCloseTo(
      vol!.periodicVolatility * Math.sqrt(52),
      10,
    );
  });

  it("produces a hand-verified value", () => {
    // Returns: [0.05, -0.03, 0.02]
    // Mean = (0.05 + -0.03 + 0.02) / 3 = 0.04/3 ≈ 0.013333
    // Deviations: 0.036667, -0.043333, 0.006667
    // Sum sq dev: 0.001344 + 0.001878 + 0.0000444 = 0.003267
    // Sample var = 0.003267 / 2 = 0.001633
    // Sample std = sqrt(0.001633) ≈ 0.04042
    const vol = calculateVolatility([0.05, -0.03, 0.02], "daily");
    expect(vol).not.toBeNull();
    expect(vol!.periodicVolatility).toBeCloseTo(0.04042, 3);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3. Maximum Drawdown
// ───────────────────────────────────────────────────────────────────────────

describe("calculateMaxDrawdown", () => {
  it("calculates drawdown for a V-shaped decline", () => {
    // Peak=100, trough=70, recovery to 90
    const dd = calculateMaxDrawdown([100, 90, 80, 70, 80, 90]);
    expect(dd).not.toBeNull();
    expect(dd!.maxDrawdownPercent).toBeCloseTo(30, 5);
    expect(dd!.peakPrice).toBe(100);
    expect(dd!.troughPrice).toBe(70);
  });

  it("returns 0% drawdown for monotonic increasing prices", () => {
    const dd = calculateMaxDrawdown([10, 20, 30, 40, 50]);
    expect(dd).not.toBeNull();
    expect(dd!.maxDrawdownPercent).toBe(0);
  });

  it("calculates full drawdown for monotonic decreasing prices", () => {
    // Peak=100, price falls to 40 → 60% drawdown
    const dd = calculateMaxDrawdown([100, 80, 60, 40]);
    expect(dd).not.toBeNull();
    expect(dd!.maxDrawdownPercent).toBeCloseTo(60, 5);
  });

  it("handles multiple peaks", () => {
    // Peak1=100, drops to 85 (15%), Peak2=110, drops to 77 (30%)
    const dd = calculateMaxDrawdown([100, 85, 95, 110, 90, 77, 100]);
    expect(dd).not.toBeNull();
    expect(dd!.maxDrawdownPercent).toBeCloseTo(30, 5);
    expect(dd!.peakPrice).toBe(110);
    expect(dd!.troughPrice).toBe(77);
  });

  it("returns 0% for flat prices", () => {
    const dd = calculateMaxDrawdown([100, 100, 100, 100]);
    expect(dd).not.toBeNull();
    expect(dd!.maxDrawdownPercent).toBe(0);
  });

  it("returns null for fewer than 2 prices", () => {
    expect(calculateMaxDrawdown([100])).toBeNull();
    expect(calculateMaxDrawdown([])).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4. Beta
// ───────────────────────────────────────────────────────────────────────────

describe("calculateBeta", () => {
  it("returns beta=1 when stock equals benchmark", () => {
    const returns = [0.01, -0.02, 0.03, 0.015, -0.005];
    const result = calculateBeta(returns, returns);
    expect(result).not.toBeNull();
    expect(result!.beta).toBeCloseTo(1.0, 2);
    expect(result!.correlation).toBeCloseTo(1.0, 2);
  });

  it("calculates positive beta for positively correlated returns", () => {
    const stock = [0.02, -0.01, 0.03, -0.02, 0.01];
    const benchmark = [0.01, -0.005, 0.02, -0.015, 0.005];
    const result = calculateBeta(stock, benchmark);
    expect(result).not.toBeNull();
    expect(result!.beta).toBeGreaterThan(0);
    expect(result!.correlation).toBeGreaterThan(0);
  });

  it("calculates negative beta for inversely correlated returns", () => {
    const stock = [0.02, -0.03, 0.04, -0.01, 0.02];
    const benchmark = [-0.02, 0.03, -0.04, 0.01, -0.02];
    const result = calculateBeta(stock, benchmark);
    expect(result).not.toBeNull();
    expect(result!.beta).toBeLessThan(0);
  });

  it("returns null for zero benchmark variance", () => {
    const stock = [0.01, -0.02, 0.03];
    const benchmark = [0, 0, 0]; // zero variance
    const result = calculateBeta(stock, benchmark);
    expect(result).toBeNull();
  });

  it("handles mismatched lengths (uses shorter)", () => {
    const stock = [0.01, -0.02, 0.03, 0.04, 0.05];
    const benchmark = [0.005, -0.01, 0.015];
    const result = calculateBeta(stock, benchmark);
    expect(result).not.toBeNull();
  });

  it("returns null for fewer than 2 returns", () => {
    expect(calculateBeta([0.01], [0.01])).toBeNull();
    expect(calculateBeta([], [])).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5. Sharpe Ratio
// ───────────────────────────────────────────────────────────────────────────

describe("calculateSharpe", () => {
  it("calculates positive Sharpe for good returns with variance", () => {
    // Varying positive returns that still have a positive mean
    const returns = [0.002, 0.001, 0.003, 0.0005, 0.0025, 0.0015, 0.002, 0.001, 0.003, 0.0005];
    const result = calculateSharpe(returns, 0.065, "daily");
    expect(result).not.toBeNull();
    expect(result!.sharpeRatio).toBeGreaterThan(0);
    expect(result!.riskFreeRate).toBe(0.065);
    expect(Number.isFinite(result!.sharpeRatio)).toBe(true);
  });

  it("returns null for zero volatility (all identical returns)", () => {
    const returns = [0.01, 0.01, 0.01, 0.01, 0.01];
    const result = calculateSharpe(returns, 0.065, "daily");
    expect(result).toBeNull(); // zero vol
  });

  it("handles mixed returns with known risk-free rate", () => {
    const returns = [0.02, -0.01, 0.03, -0.015, 0.025, -0.005, 0.01];
    const result = calculateSharpe(returns, 0.065, "daily");
    expect(result).not.toBeNull();
    expect(result!.riskFreeRate).toBe(0.065);
    expect(Number.isFinite(result!.sharpeRatio)).toBe(true);
  });

  it("returns null for insufficient data", () => {
    expect(calculateSharpe([0.01], 0.065)).toBeNull();
    expect(calculateSharpe([], 0.065)).toBeNull();
  });

  it("never produces NaN or Infinity", () => {
    const returns = [0.001, -0.002, 0.003];
    const result = calculateSharpe(returns, 0.065, "daily");
    if (result) {
      expect(Number.isFinite(result.sharpeRatio)).toBe(true);
      expect(Number.isNaN(result.sharpeRatio)).toBe(false);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6. Sortino Ratio
// ───────────────────────────────────────────────────────────────────────────

describe("calculateSortino", () => {
  it("calculates Sortino with downside returns present", () => {
    const returns = [0.02, -0.03, 0.01, -0.02, 0.04, -0.01];
    const result = calculateSortino(returns, 0.065, "daily");
    expect(result).not.toBeNull();
    expect(result!.targetReturn).toBe(0.065);
    expect(result!.downsideDeviation).toBeGreaterThan(0);
    expect(Number.isFinite(result!.sortinoRatio)).toBe(true);
  });

  it("returns null when there are no downside returns", () => {
    // All returns above the periodic target
    const returns = [0.05, 0.04, 0.06, 0.03, 0.07];
    const result = calculateSortino(returns, 0.0, "daily");
    expect(result).toBeNull(); // No downside → null
  });

  it("returns null for insufficient data", () => {
    expect(calculateSortino([0.01], 0.065)).toBeNull();
  });

  it("never produces NaN or Infinity", () => {
    const returns = [0.01, -0.02, 0.005, -0.015];
    const result = calculateSortino(returns, 0.065, "daily");
    if (result) {
      expect(Number.isFinite(result.sortinoRatio)).toBe(true);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 7. Historical VaR
// ───────────────────────────────────────────────────────────────────────────

describe("calculateHistoricalVaR", () => {
  it("calculates VaR at 95% confidence", () => {
    // 20 sorted returns: we need the 5th percentile
    // (1-0.95) * 20 = 1.0 → index 0 (the worst return)
    const returns = [
      -0.05, -0.04, -0.03, -0.02, -0.01,
       0.00,  0.01,  0.02,  0.03,  0.04,
       0.01,  0.02, -0.005,  0.015, 0.025,
      -0.008, 0.03, -0.012,  0.005, 0.02,
    ];
    const result = calculateHistoricalVaR(returns, 0.95);
    expect(result).not.toBeNull();
    expect(result!.method).toBe("historical");
    expect(result!.confidenceLevel).toBe(0.95);
    expect(result!.varPercent).toBeGreaterThan(0);
  });

  it("returns null for fewer than 5 returns", () => {
    expect(calculateHistoricalVaR([0.01, -0.02, 0.03, 0.01], 0.95)).toBeNull();
  });

  it("returns null for invalid confidence level", () => {
    const returns = [0.01, -0.02, 0.03, -0.01, 0.02, 0.015];
    expect(calculateHistoricalVaR(returns, 0)).toBeNull();
    expect(calculateHistoricalVaR(returns, 1)).toBeNull();
    expect(calculateHistoricalVaR(returns, 1.5)).toBeNull();
  });

  it("returns a larger VaR at higher confidence", () => {
    const returns = [
      -0.05, -0.04, -0.03, -0.02, -0.01,
       0.00,  0.01,  0.02,  0.03,  0.04,
       0.01,  0.02, -0.005,  0.015, 0.025,
      -0.008, 0.03, -0.012,  0.005, 0.02,
    ];
    const var95 = calculateHistoricalVaR(returns, 0.95);
    const var99 = calculateHistoricalVaR(returns, 0.99);
    expect(var95).not.toBeNull();
    expect(var99).not.toBeNull();
    // 99% VaR should be >= 95% VaR (wider tail)
    expect(var99!.varPercent).toBeGreaterThanOrEqual(var95!.varPercent);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 8. CVaR
// ───────────────────────────────────────────────────────────────────────────

describe("calculateCVaR", () => {
  it("calculates CVaR as mean of tail returns", () => {
    const returns = [
      -0.05, -0.04, -0.03, -0.02, -0.01,
       0.00,  0.01,  0.02,  0.03,  0.04,
    ];
    const result = calculateCVaR(returns, 0.95);
    expect(result).not.toBeNull();
    expect(result!.cvarPercent).toBeGreaterThan(0);
    expect(result!.tailObservations).toBeGreaterThan(0);
  });

  it("CVaR >= VaR (expected shortfall is at least as large)", () => {
    const returns = [
      -0.05, -0.04, -0.03, -0.02, -0.01,
       0.00,  0.01,  0.02,  0.03,  0.04,
       0.01,  0.02, -0.005,  0.015, 0.025,
      -0.008, 0.03, -0.012,  0.005, 0.02,
    ];
    const varResult = calculateHistoricalVaR(returns, 0.95);
    const cvarResult = calculateCVaR(returns, 0.95);
    if (varResult && cvarResult) {
      expect(cvarResult.cvarPercent).toBeGreaterThanOrEqual(varResult.varPercent);
    }
  });

  it("returns null for fewer than 5 returns", () => {
    expect(calculateCVaR([0.01, -0.02], 0.95)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 9. Annualized Return
// ───────────────────────────────────────────────────────────────────────────

describe("annualizeReturn", () => {
  it("annualizes daily mean return", () => {
    // Mean daily return = 0.001 → annual = 0.001 * 252 = 0.252
    const returns = [0.001, 0.001, 0.001];
    expect(annualizeReturn(returns, "daily")).toBeCloseTo(0.252, 5);
  });

  it("returns 0 for empty array", () => {
    expect(annualizeReturn([])).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 10. Input Validation
// ───────────────────────────────────────────────────────────────────────────

describe("validatePrices", () => {
  it("passes for valid prices", () => {
    expect(() => validatePrices([100, 200, 150])).not.toThrow();
  });

  it("rejects empty array", () => {
    expect(() => validatePrices([])).toThrow();
  });

  it("rejects single price", () => {
    expect(() => validatePrices([100])).toThrow();
  });

  it("rejects negative prices", () => {
    expect(() => validatePrices([100, -50])).toThrow();
  });

  it("rejects NaN", () => {
    expect(() => validatePrices([100, NaN])).toThrow();
  });

  it("rejects Infinity", () => {
    expect(() => validatePrices([100, Infinity])).toThrow();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 11. Risk Scoring
// ───────────────────────────────────────────────────────────────────────────

describe("calculateRiskScore", () => {
  it("produces a score between 0 and 100", () => {
    const metrics: RiskMetrics = {
      volatility: {
        periodicVolatility: 0.02,
        annualizedVolatility: 0.32,
        frequency: "daily",
        observationCount: 252,
      },
      maxDrawdown: {
        maxDrawdownPercent: 25,
        peakPrice: 100,
        troughPrice: 75,
        peakIndex: 10,
        troughIndex: 50,
      },
      beta: null,
      sharpe: {
        sharpeRatio: 0.8,
        annualizedReturn: 0.15,
        riskFreeRate: 0.065,
        annualizedVolatility: 0.32,
      },
      sortino: null,
      var: {
        varPercent: 2.5,
        confidenceLevel: 0.95,
        method: "historical",
      },
      cvar: null,
    };

    const { score, components } = calculateRiskScore(metrics);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);

    // All available components should have positive weights
    const available = components.filter((c) => c.available);
    expect(available.length).toBeGreaterThan(0);
    for (const comp of available) {
      expect(comp.weight).toBeGreaterThan(0);
    }

    // Unavailable components should have weight=0
    const unavailable = components.filter((c) => !c.available);
    for (const comp of unavailable) {
      expect(comp.weight).toBe(0);
    }
  });

  it("handles all-null metrics gracefully", () => {
    const metrics: RiskMetrics = {
      volatility: null,
      maxDrawdown: null,
      beta: null,
      sharpe: null,
      sortino: null,
      var: null,
      cvar: null,
    };

    const { score, components } = calculateRiskScore(metrics);
    expect(score).toBe(0);
    expect(components.every((c) => !c.available)).toBe(true);
  });

  it("redistributes weights when beta is unavailable", () => {
    const metricsWithBeta: RiskMetrics = {
      volatility: {
        periodicVolatility: 0.02,
        annualizedVolatility: 0.30,
        frequency: "daily",
        observationCount: 100,
      },
      maxDrawdown: { maxDrawdownPercent: 20, peakPrice: 100, troughPrice: 80, peakIndex: 0, troughIndex: 5 },
      beta: { beta: 1.2, correlation: 0.9 },
      sharpe: { sharpeRatio: 1.0, annualizedReturn: 0.15, riskFreeRate: 0.065, annualizedVolatility: 0.30 },
      sortino: null,
      var: { varPercent: 2.0, confidenceLevel: 0.95, method: "historical" },
      cvar: null,
    };

    const metricsWithoutBeta: RiskMetrics = {
      ...metricsWithBeta,
      beta: null,
    };

    const withBeta = calculateRiskScore(metricsWithBeta);
    const withoutBeta = calculateRiskScore(metricsWithoutBeta);

    // Without beta, the available components' weights should sum to ~1.0
    const availableWeightSum = withoutBeta.components
      .filter((c) => c.available)
      .reduce((sum, c) => sum + c.weight, 0);
    expect(availableWeightSum).toBeCloseTo(1.0, 2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 12. Risk Classification
// ───────────────────────────────────────────────────────────────────────────

describe("classifyRisk", () => {
  it("classifies boundary values correctly", () => {
    expect(classifyRisk(0)).toBe("Very Low Risk");
    expect(classifyRisk(20)).toBe("Very Low Risk");
    expect(classifyRisk(21)).toBe("Low Risk");
    expect(classifyRisk(40)).toBe("Low Risk");
    expect(classifyRisk(41)).toBe("Moderate Risk");
    expect(classifyRisk(60)).toBe("Moderate Risk");
    expect(classifyRisk(61)).toBe("High Risk");
    expect(classifyRisk(80)).toBe("High Risk");
    expect(classifyRisk(81)).toBe("Very High Risk");
    expect(classifyRisk(100)).toBe("Very High Risk");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 13. Explanation Generator
// ───────────────────────────────────────────────────────────────────────────

describe("generateExplanations", () => {
  it("generates explanations from components", () => {
    const components = [
      { name: "Volatility Risk", rawScore: 75, weight: 0.33, weightedScore: 24.75, available: true, explanation: "High volatility." },
      { name: "Market Sensitivity", rawScore: 0, weight: 0, weightedScore: 0, available: false, explanation: "No benchmark." },
    ];

    const explanations = generateExplanations(components, "High Risk");
    expect(explanations.length).toBeGreaterThan(0);
    expect(explanations.some((e) => e.includes("volatility"))).toBe(true);
    expect(explanations.some((e) => e.includes("Market Sensitivity"))).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 14. NaN/Infinity Prevention (integration-level)
// ───────────────────────────────────────────────────────────────────────────

describe("NaN/Infinity prevention", () => {
  it("no metric produces NaN from valid input", () => {
    const prices = [100, 102, 98, 105, 101, 99, 103, 107, 95, 110];
    const returns = calculateReturns(prices);

    const vol = calculateVolatility(returns, "daily");
    const dd = calculateMaxDrawdown(prices);
    const sharpe = calculateSharpe(returns, 0.065, "daily");
    const sortino = calculateSortino(returns, 0.065, "daily");
    const varResult = calculateHistoricalVaR(returns, 0.95);
    const cvarResult = calculateCVaR(returns, 0.95);

    if (vol) {
      expect(Number.isNaN(vol.periodicVolatility)).toBe(false);
      expect(Number.isNaN(vol.annualizedVolatility)).toBe(false);
    }
    if (dd) expect(Number.isNaN(dd.maxDrawdownPercent)).toBe(false);
    if (sharpe) expect(Number.isNaN(sharpe.sharpeRatio)).toBe(false);
    if (sortino) expect(Number.isNaN(sortino.sortinoRatio)).toBe(false);
    if (varResult) expect(Number.isNaN(varResult.varPercent)).toBe(false);
    if (cvarResult) expect(Number.isNaN(cvarResult.cvarPercent)).toBe(false);
  });

  it("scoring never produces NaN from extreme metrics", () => {
    const extremeMetrics: RiskMetrics = {
      volatility: {
        periodicVolatility: 0.15,
        annualizedVolatility: 2.38, // extremely high
        frequency: "daily",
        observationCount: 10,
      },
      maxDrawdown: {
        maxDrawdownPercent: 95, // extreme crash
        peakPrice: 1000,
        troughPrice: 50,
        peakIndex: 0,
        troughIndex: 5,
      },
      beta: null,
      sharpe: {
        sharpeRatio: -3.0, // terrible
        annualizedReturn: -0.5,
        riskFreeRate: 0.065,
        annualizedVolatility: 2.38,
      },
      sortino: null,
      var: {
        varPercent: 15.0, // very high
        confidenceLevel: 0.95,
        method: "historical",
      },
      cvar: null,
    };

    const { score } = calculateRiskScore(extremeMetrics);
    expect(Number.isNaN(score)).toBe(false);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
