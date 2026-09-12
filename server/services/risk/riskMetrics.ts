// ═══════════════════════════════════════════════════════════════════════════
// ProfitX Deterministic Stock Risk Engine — Mathematical Metrics
// ═══════════════════════════════════════════════════════════════════════════
//
// IMPORTANT: This module contains ONLY pure mathematical functions.
// No database access, no HTTP, no side effects.
// Every function is deterministic and independently testable.
//
// All financial metrics follow standard quantitative finance conventions.
// References are documented inline.
//
// ═══════════════════════════════════════════════════════════════════════════

import type {
  BetaResult,
  CVaRResult,
  DataFrequency,
  DrawdownResult,
  SharpeResult,
  SortinoResult,
  VaRResult,
  VolatilityResult,
} from "./types";
import { TRADING_PERIODS_PER_YEAR } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Input Validation
// ───────────────────────────────────────────────────────────────────────────

/**
 * Validates that a price series is suitable for financial analysis.
 * Throws a descriptive error if validation fails.
 */
export function validatePrices(prices: number[]): void {
  if (!Array.isArray(prices) || prices.length < 2) {
    throw new Error("At least 2 valid prices are required for analysis.");
  }
  for (let i = 0; i < prices.length; i++) {
    const p = prices[i];
    if (typeof p !== "number" || !Number.isFinite(p) || p <= 0) {
      throw new Error(
        `Invalid price at index ${i}: ${p}. Prices must be positive finite numbers.`,
      );
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Simple Returns
// ───────────────────────────────────────────────────────────────────────────

/**
 * Calculate simple returns from a chronologically-ordered price series.
 *
 * Formula: R_t = (P_t / P_{t-1}) - 1
 *
 * @param prices - Array of positive prices in chronological order [oldest → newest]
 * @returns Array of (n-1) simple returns
 */
export function calculateReturns(prices: number[]): number[] {
  validatePrices(prices);

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const ret = prices[i] / prices[i - 1] - 1;
    // Guard against any floating-point anomaly
    if (!Number.isFinite(ret)) {
      throw new Error(
        `Non-finite return at index ${i}: P[${i}]=${prices[i]}, P[${i - 1}]=${prices[i - 1]}`,
      );
    }
    returns.push(ret);
  }
  return returns;
}

// ───────────────────────────────────────────────────────────────────────────
// Volatility (Historical)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Calculate historical volatility from a return series.
 *
 * Uses sample standard deviation: σ = sqrt( Σ(R_i - mean)² / (n - 1) )
 * Annualized: σ_annual = σ_periodic × sqrt(tradingPeriodsPerYear)
 *
 * @param returns - Array of periodic returns
 * @param frequency - Data frequency for annualization
 * @returns VolatilityResult or null if insufficient data
 */
export function calculateVolatility(
  returns: number[],
  frequency: DataFrequency = "daily",
): VolatilityResult | null {
  if (returns.length < 2) return null;

  const n = returns.length;
  const mean = returns.reduce((sum, r) => sum + r, 0) / n;

  const sumSquaredDeviations = returns.reduce(
    (sum, r) => sum + (r - mean) ** 2,
    0,
  );

  // Sample standard deviation (Bessel's correction: n-1)
  const periodicVolatility = Math.sqrt(sumSquaredDeviations / (n - 1));

  if (!Number.isFinite(periodicVolatility)) return null;

  const annualizationFactor = Math.sqrt(TRADING_PERIODS_PER_YEAR[frequency]);
  const annualizedVolatility = periodicVolatility * annualizationFactor;

  return {
    periodicVolatility,
    annualizedVolatility,
    frequency,
    observationCount: n,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Maximum Drawdown
// ───────────────────────────────────────────────────────────────────────────

/**
 * Calculate Maximum Drawdown from a price series.
 *
 * For each observation:
 *   Peak_t = max(P_0 ... P_t)
 *   Drawdown_t = (P_t - Peak_t) / Peak_t
 *   MaxDrawdown = min(Drawdown_t)     (most negative value)
 *
 * The result is returned as a POSITIVE percentage.
 * Example: Peak=100, Trough=70 → maxDrawdownPercent = 30
 *
 * @param prices - Chronologically ordered positive prices
 * @returns DrawdownResult or null if insufficient data
 */
export function calculateMaxDrawdown(
  prices: number[],
): DrawdownResult | null {
  if (prices.length < 2) return null;

  let peak = prices[0];
  let peakIndex = 0;
  let maxDrawdown = 0; // as a negative fraction
  let worstPeakIndex = 0;
  let worstTroughIndex = 0;
  let worstPeakPrice = prices[0];
  let worstTroughPrice = prices[0];

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i];
      peakIndex = i;
    }

    const drawdown = (prices[i] - peak) / peak; // negative or zero

    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      worstPeakIndex = peakIndex;
      worstTroughIndex = i;
      worstPeakPrice = peak;
      worstTroughPrice = prices[i];
    }
  }

  return {
    maxDrawdownPercent: Math.abs(maxDrawdown) * 100,
    peakPrice: worstPeakPrice,
    troughPrice: worstTroughPrice,
    peakIndex: worstPeakIndex,
    troughIndex: worstTroughIndex,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Beta
// ───────────────────────────────────────────────────────────────────────────

/**
 * Calculate Beta relative to a benchmark.
 *
 * β = Cov(R_stock, R_market) / Var(R_market)
 *
 * @param stockReturns - Stock return series
 * @param benchmarkReturns - Benchmark return series (must be same length)
 * @returns BetaResult or null if calculation is not possible
 */
export function calculateBeta(
  stockReturns: number[],
  benchmarkReturns: number[],
): BetaResult | null {
  if (stockReturns.length < 2 || benchmarkReturns.length < 2) return null;

  // Use the shorter length to handle minor mismatches
  const n = Math.min(stockReturns.length, benchmarkReturns.length);

  const meanStock =
    stockReturns.slice(0, n).reduce((s, r) => s + r, 0) / n;
  const meanBenchmark =
    benchmarkReturns.slice(0, n).reduce((s, r) => s + r, 0) / n;

  let covariance = 0;
  let varianceBenchmark = 0;
  let varianceStock = 0;

  for (let i = 0; i < n; i++) {
    const dStock = stockReturns[i] - meanStock;
    const dBenchmark = benchmarkReturns[i] - meanBenchmark;
    covariance += dStock * dBenchmark;
    varianceBenchmark += dBenchmark ** 2;
    varianceStock += dStock ** 2;
  }

  covariance /= n - 1;
  varianceBenchmark /= n - 1;
  varianceStock /= n - 1;

  // Avoid division by zero: if the benchmark has no variance, beta is undefined
  if (varianceBenchmark < 1e-15) return null;

  const beta = covariance / varianceBenchmark;
  if (!Number.isFinite(beta)) return null;

  // Pearson correlation
  const denominator = Math.sqrt(varianceStock * varianceBenchmark);
  const correlation = denominator < 1e-15 ? 0 : covariance / denominator;

  return {
    beta: Number(beta.toFixed(4)),
    correlation: Number(
      (Number.isFinite(correlation) ? correlation : 0).toFixed(4),
    ),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Annualized Return (helper)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Calculate annualized return from periodic returns.
 *
 * Uses arithmetic annualization: mean(R) × tradingPeriodsPerYear
 */
export function annualizeReturn(
  returns: number[],
  frequency: DataFrequency = "daily",
): number {
  if (returns.length === 0) return 0;
  const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  return meanReturn * TRADING_PERIODS_PER_YEAR[frequency];
}

// ───────────────────────────────────────────────────────────────────────────
// Sharpe Ratio
// ───────────────────────────────────────────────────────────────────────────

/**
 * Calculate Sharpe Ratio.
 *
 * Sharpe = (Annualized Return - Risk-Free Rate) / Annualized Volatility
 *
 * @param returns - Periodic return series
 * @param riskFreeRate - Annual risk-free rate (e.g., 0.065 for 6.5%)
 * @param frequency - Data frequency for annualization
 * @returns SharpeResult or null if volatility is zero/undefined
 */
export function calculateSharpe(
  returns: number[],
  riskFreeRate: number,
  frequency: DataFrequency = "daily",
): SharpeResult | null {
  if (returns.length < 2) return null;

  const vol = calculateVolatility(returns, frequency);
  if (!vol || vol.annualizedVolatility < 1e-10) return null;

  const annReturn = annualizeReturn(returns, frequency);
  const sharpe = (annReturn - riskFreeRate) / vol.annualizedVolatility;

  if (!Number.isFinite(sharpe)) return null;

  return {
    sharpeRatio: Number(sharpe.toFixed(4)),
    annualizedReturn: Number(annReturn.toFixed(6)),
    riskFreeRate,
    annualizedVolatility: vol.annualizedVolatility,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Sortino Ratio
// ───────────────────────────────────────────────────────────────────────────

/**
 * Calculate Sortino Ratio.
 *
 * Sortino = (Annualized Return - Target Return) / Downside Deviation
 *
 * Downside deviation uses only negative deviations from the target return
 * (converted to periodic target for comparison with periodic returns).
 *
 * @param returns - Periodic return series
 * @param riskFreeRate - Used as the target/minimum acceptable return (annual)
 * @param frequency - Data frequency for annualization
 * @returns SortinoResult or null if downside deviation is zero
 */
export function calculateSortino(
  returns: number[],
  riskFreeRate: number,
  frequency: DataFrequency = "daily",
): SortinoResult | null {
  if (returns.length < 2) return null;

  const periodsPerYear = TRADING_PERIODS_PER_YEAR[frequency];
  // Convert annual target to periodic
  const periodicTarget = riskFreeRate / periodsPerYear;

  // Downside deviation: only consider returns below the target
  let sumSquaredDownside = 0;
  let downsideCount = 0;

  for (const r of returns) {
    const deviation = r - periodicTarget;
    if (deviation < 0) {
      sumSquaredDownside += deviation ** 2;
      downsideCount++;
    }
  }

  // If no downside observations, downside risk is effectively zero
  if (downsideCount === 0) return null;

  const periodicDownsideDev = Math.sqrt(sumSquaredDownside / returns.length);
  const annualizedDownsideDev =
    periodicDownsideDev * Math.sqrt(periodsPerYear);

  if (annualizedDownsideDev < 1e-10) return null;

  const annReturn = annualizeReturn(returns, frequency);
  const sortino = (annReturn - riskFreeRate) / annualizedDownsideDev;

  if (!Number.isFinite(sortino)) return null;

  return {
    sortinoRatio: Number(sortino.toFixed(4)),
    annualizedReturn: Number(annReturn.toFixed(6)),
    targetReturn: riskFreeRate,
    downsideDeviation: annualizedDownsideDev,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Historical Value at Risk (VaR)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Calculate Historical VaR using the empirical percentile method.
 *
 * VaR at confidence α is the (1-α) percentile of the return distribution.
 * Example: 95% confidence → 5th percentile of returns.
 *
 * Result is returned as a POSITIVE percentage representing the loss threshold.
 *
 * @param returns - Periodic return series
 * @param confidenceLevel - Confidence level (e.g., 0.95 for 95%)
 * @returns VaRResult or null if insufficient data
 */
export function calculateHistoricalVaR(
  returns: number[],
  confidenceLevel: number = 0.95,
): VaRResult | null {
  if (returns.length < 5) return null;
  if (confidenceLevel <= 0 || confidenceLevel >= 1) return null;

  // Sort returns ascending (worst → best)
  const sorted = [...returns].sort((a, b) => a - b);

  // Percentile index: (1 - confidence) × n
  // Using the "nearest rank" method
  const percentileRank = (1 - confidenceLevel) * sorted.length;
  const index = Math.max(0, Math.ceil(percentileRank) - 1);

  const varValue = sorted[index]; // This is negative for a loss

  if (!Number.isFinite(varValue)) return null;

  return {
    // Return as positive percentage
    varPercent: Number((Math.abs(varValue) * 100).toFixed(4)),
    confidenceLevel,
    method: "historical",
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Conditional VaR (CVaR / Expected Shortfall)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Calculate Conditional VaR (Expected Shortfall).
 *
 * CVaR is the average of all returns that fall below (or at) the VaR threshold.
 * It represents the expected loss given that losses exceed VaR.
 *
 * @param returns - Periodic return series
 * @param confidenceLevel - Confidence level (e.g., 0.95)
 * @returns CVaRResult or null if insufficient tail data
 */
export function calculateCVaR(
  returns: number[],
  confidenceLevel: number = 0.95,
): CVaRResult | null {
  if (returns.length < 5) return null;
  if (confidenceLevel <= 0 || confidenceLevel >= 1) return null;

  const sorted = [...returns].sort((a, b) => a - b);
  const cutoffIndex = Math.ceil((1 - confidenceLevel) * sorted.length);

  if (cutoffIndex === 0) return null;

  // Average of the tail (worst returns)
  const tail = sorted.slice(0, cutoffIndex);
  const avgTailReturn = tail.reduce((s, r) => s + r, 0) / tail.length;

  if (!Number.isFinite(avgTailReturn)) return null;

  return {
    cvarPercent: Number((Math.abs(avgTailReturn) * 100).toFixed(4)),
    confidenceLevel,
    tailObservations: tail.length,
  };
}
