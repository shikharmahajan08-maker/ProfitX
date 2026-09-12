// ═══════════════════════════════════════════════════════════════════════════
// ProfitX Deterministic Portfolio Risk Engine — Mathematical Metrics
// ═══════════════════════════════════════════════════════════════════════════

import type { DiversificationMetrics } from "./portfolioTypes";
import { TRADING_PERIODS_PER_YEAR } from "./types";
import { calculateReturns, calculateVolatility } from "./riskMetrics";

// ───────────────────────────────────────────────────────────────────────────
// Data Alignment
// ───────────────────────────────────────────────────────────────────────────

export interface AlignedData {
  dates: string[];
  returnsBySymbol: Record<string, number[]>;
  symbols: string[];
}

/**
 * Aligns historical closing prices by date to ensure mathematical validity
 * for correlation and covariance matrix calculations.
 *
 * @param priceHistory - Map of symbol -> array of { date, price }
 * @returns AlignedData structure with synchronous returns
 */
export function alignReturns(
  priceHistory: Record<string, { date: string; price: number }[]>,
): AlignedData {
  const symbols = Object.keys(priceHistory);
  if (symbols.length === 0) {
    return { dates: [], returnsBySymbol: {}, symbols: [] };
  }

  // Find overlapping dates
  // Start with dates from the first symbol, then intersect
  const dateSets = symbols.map((sym) => new Set(priceHistory[sym].map((p) => p.date)));
  
  let commonDates = Array.from(dateSets[0]);
  for (let i = 1; i < dateSets.length; i++) {
    commonDates = commonDates.filter((d) => dateSets[i].has(d));
  }

  // Sort dates chronologically
  commonDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Extract aligned prices
  const alignedPrices: Record<string, number[]> = {};
  for (const sym of symbols) {
    const priceMap = new Map(priceHistory[sym].map((p) => [p.date, p.price]));
    alignedPrices[sym] = commonDates.map((d) => priceMap.get(d)!);
  }

  // Calculate simple returns from the aligned prices
  // Note: N prices yield N-1 returns.
  const returnsBySymbol: Record<string, number[]> = {};
  const returnDates = commonDates.slice(1);

  for (const sym of symbols) {
    try {
      returnsBySymbol[sym] = calculateReturns(alignedPrices[sym]);
    } catch {
      returnsBySymbol[sym] = []; // Fallback if calculateReturns fails (e.g. invalid price)
    }
  }

  return { dates: returnDates, returnsBySymbol, symbols };
}

// ───────────────────────────────────────────────────────────────────────────
// Portfolio Returns & Drawdown Pre-computation
// ───────────────────────────────────────────────────────────────────────────

/**
 * Construct historical portfolio returns using fixed weights.
 * R_{p,t} = Σ(w_i × R_{i,t})
 */
export function calculatePortfolioReturns(
  weights: Record<string, number>,
  alignedData: AlignedData,
): number[] {
  const { dates, returnsBySymbol, symbols } = alignedData;
  const numObs = dates.length;
  const portReturns = new Array(numObs).fill(0);

  for (let t = 0; t < numObs; t++) {
    let dayReturn = 0;
    for (const sym of symbols) {
      const w = weights[sym] || 0;
      dayReturn += w * returnsBySymbol[sym][t];
    }
    portReturns[t] = dayReturn;
  }

  return portReturns;
}

/**
 * Reconstruct a normalized portfolio equity curve from portfolio returns.
 * Starts at 1.0 (or 100). This allows Max Drawdown to be calculated
 * using the existing Phase 2 price-based Max Drawdown function.
 */
export function reconstructPortfolioEquityCurve(portReturns: number[]): number[] {
  const equity = [1.0];
  let current = 1.0;
  for (const r of portReturns) {
    current = current * (1 + r);
    equity.push(current);
  }
  return equity;
}

// ───────────────────────────────────────────────────────────────────────────
// Covariance & Correlation Matrices
// ───────────────────────────────────────────────────────────────────────────

/**
 * Computes the sample covariance matrix for the aligned returns.
 */
export function calculateCovarianceMatrix(
  alignedData: AlignedData,
): Record<string, Record<string, number>> {
  const { returnsBySymbol, symbols, dates } = alignedData;
  const n = dates.length;
  const matrix: Record<string, Record<string, number>> = {};

  if (n < 2) return matrix; // Insufficient data

  // Precompute means
  const means: Record<string, number> = {};
  for (const sym of symbols) {
    const sum = returnsBySymbol[sym].reduce((acc, val) => acc + val, 0);
    means[sym] = sum / n;
  }

  for (const sym1 of symbols) {
    matrix[sym1] = {};
    for (const sym2 of symbols) {
      // Exploit symmetry: Cov(A,B) = Cov(B,A)
      if (matrix[sym2] && matrix[sym2][sym1] !== undefined) {
        matrix[sym1][sym2] = matrix[sym2][sym1];
        continue;
      }

      let cov = 0;
      for (let t = 0; t < n; t++) {
        cov += (returnsBySymbol[sym1][t] - means[sym1]) * (returnsBySymbol[sym2][t] - means[sym2]);
      }
      matrix[sym1][sym2] = cov / (n - 1);
    }
  }

  return matrix;
}

/**
 * Computes the Pearson correlation matrix from the covariance matrix.
 * Cor(A,B) = Cov(A,B) / (Std(A) * Std(B))
 */
export function calculateCorrelationMatrix(
  covMatrix: Record<string, Record<string, number>>,
  symbols: string[],
): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};
  
  // Extract standard deviations from the diagonal
  const stdDevs: Record<string, number> = {};
  for (const sym of symbols) {
    stdDevs[sym] = Math.sqrt(covMatrix[sym]?.[sym] || 0);
  }

  for (const sym1 of symbols) {
    matrix[sym1] = {};
    for (const sym2 of symbols) {
      if (sym1 === sym2) {
        matrix[sym1][sym2] = 1.0;
      } else {
        const std1 = stdDevs[sym1];
        const std2 = stdDevs[sym2];
        const cov = covMatrix[sym1]?.[sym2] || 0;
        
        if (std1 < 1e-15 || std2 < 1e-15) {
          matrix[sym1][sym2] = 0; // Prevent division by zero
        } else {
          // Clamp to [-1, 1] to prevent floating point drift
          const cor = cov / (std1 * std2);
          matrix[sym1][sym2] = Math.max(-1, Math.min(1, cor));
        }
      }
    }
  }

  return matrix;
}

// ───────────────────────────────────────────────────────────────────────────
// Portfolio Volatility & Risk Contribution
// ───────────────────────────────────────────────────────────────────────────

/**
 * Calculate total portfolio variance: w^T * Cov * w
 */
export function calculatePortfolioVariance(
  weights: Record<string, number>,
  covMatrix: Record<string, Record<string, number>>,
  symbols: string[],
): number {
  let portVariance = 0;
  for (const i of symbols) {
    for (const j of symbols) {
      const wi = weights[i] || 0;
      const wj = weights[j] || 0;
      const cov = covMatrix[i]?.[j] || 0;
      portVariance += wi * wj * cov;
    }
  }
  return Math.max(0, portVariance); // Guard against microscopic negative drift
}

/**
 * Compute Marginal Contribution to Risk (MCR) and Component Contribution for each asset.
 *
 * MCR_i = (Cov * w)_i / portVol
 * ComponentContribution_i = w_i * MCR_i
 * PercentageContribution_i = ComponentContribution_i / portVol
 */
export function calculateRiskContributions(
  weights: Record<string, number>,
  covMatrix: Record<string, Record<string, number>>,
  symbols: string[],
  portVariance: number,
): Record<string, { mcr: number; component: number; percentage: number }> {
  const contributions: Record<string, { mcr: number; component: number; percentage: number }> = {};
  const portVol = Math.sqrt(portVariance);

  if (portVol < 1e-10) {
    for (const sym of symbols) {
      contributions[sym] = { mcr: 0, component: 0, percentage: 0 };
    }
    return contributions;
  }

  for (const i of symbols) {
    // Calculate (Cov * w)_i
    let covSum = 0;
    for (const j of symbols) {
      covSum += (covMatrix[i]?.[j] || 0) * (weights[j] || 0);
    }
    
    const mcr = covSum / portVol;
    const wi = weights[i] || 0;
    const component = wi * mcr;
    const percentage = (component / portVol) * 100;

    contributions[i] = {
      mcr,
      component,
      percentage,
    };
  }

  return contributions;
}

// ───────────────────────────────────────────────────────────────────────────
// Diversification Metrics
// ───────────────────────────────────────────────────────────────────────────

export function calculateDiversificationMetrics(
  weights: Record<string, number>,
): DiversificationMetrics {
  const wValues = Object.values(weights).filter(w => w > 0);
  const n = wValues.length;
  
  if (n === 0) {
    return {
      numberOfHoldings: 0,
      effectiveNumberOfHoldings: 0,
      hhi: 0,
      largestHoldingWeight: 0,
      top3Concentration: 0,
      top5Concentration: 0,
    };
  }

  // HHI = sum(w_i^2) where w_i is fraction 0..1. Multiply by 10000 for standard scale if desired,
  // but we keep it 0..1 for mathematical consistency.
  let hhi = 0;
  for (const w of wValues) {
    hhi += w * w;
  }

  // ENH = 1 / HHI
  const enh = hhi > 0 ? 1 / hhi : 0;

  // Concentrations
  const sortedW = [...wValues].sort((a, b) => b - a);
  const top3 = sortedW.slice(0, 3).reduce((sum, w) => sum + w, 0);
  const top5 = sortedW.slice(0, 5).reduce((sum, w) => sum + w, 0);

  return {
    numberOfHoldings: n,
    effectiveNumberOfHoldings: enh,
    hhi,
    largestHoldingWeight: sortedW[0],
    top3Concentration: top3,
    top5Concentration: top5,
  };
}
