# ProfitX Deterministic Stock Risk Engine

## 1. Purpose

The Risk Engine provides deterministic, explainable, and testable stock-level risk analysis for the ProfitX paper-trading platform. It calculates quantitative risk metrics from historical price data and produces a composite risk score on a 0–100 scale.

**Important:** The Risk Engine is analytical and read-only. It never modifies portfolios, holdings, orders, transactions, or any financial state.

## 2. Architecture

```
Market Data (market_data table)
        ↓
Historical Price Series (closing prices)
        ↓
riskMetrics.ts (pure mathematical functions)
        ↓
riskScoring.ts (normalization, weighting, classification)
        ↓
riskEngine.ts (orchestration, DB queries, assembly)
        ↓
tRPC API (risk.stock procedure)
        ↓
Frontend (StockDetail.tsx Risk Analysis section)
```

### Module Responsibilities

| Module | Purpose |
|---|---|
| `types.ts` | Type definitions, constants, classification thresholds |
| `riskMetrics.ts` | Pure math: returns, volatility, drawdown, beta, Sharpe, Sortino, VaR, CVaR |
| `riskScoring.ts` | Normalizes metrics to 0–100, applies weights, classifies, generates explanations |
| `riskEngine.ts` | Orchestrates DB lookup, metric calculation, scoring, and result assembly |

## 3. Input Data

Historical OHLCV data from the `market_data` database table. In V1, this data is **simulated** — generated deterministically by `stockSyncService.ts` using a seeded pseudo-random walk. Each stock receives ~252 daily observations (approximately 1 trading year).

**This is NOT real market data.** It is simulated for the development environment.

## 4. Return Calculation

Simple returns are used:

```
R_t = (P_t / P_{t-1}) - 1
```

Log returns are not mixed with simple returns. Input validation rejects prices that are non-positive, NaN, or Infinity.

## 5. Volatility

Historical volatility using sample standard deviation (Bessel's correction):

```
σ = sqrt( Σ(R_i - mean(R))² / (n - 1) )
```

Annualized: `σ_annual = σ_daily × √252`

## 6. Maximum Drawdown

```
Peak_t = max(P_0 ... P_t)
Drawdown_t = (P_t - Peak_t) / Peak_t
MaxDrawdown = min(Drawdown_t)
```

Returned as a positive percentage (e.g., 30% means a 30% peak-to-trough decline).

## 7. Beta

```
β = Cov(R_stock, R_market) / Var(R_market)
```

**V1 Status:** Beta is **unavailable** because no legitimate benchmark index exists in the current data provider. The engine returns `null` with an explicit reason. Beta support is architecturally ready — adding a benchmark requires only providing its return series.

## 8. Sharpe Ratio

```
Sharpe = (Annualized Return - Risk-Free Rate) / Annualized Volatility
```

- Risk-free rate: configurable, defaults to **6.5%** (approximate Indian 10-year government bond yield)
- Zero volatility safely returns `null` instead of Infinity

## 9. Sortino Ratio

```
Sortino = (Annualized Return - Target Return) / Downside Deviation
```

- Target return equals the risk-free rate (converted to periodic frequency)
- Downside deviation uses only negative deviations from the target
- Zero downside deviation safely returns `null`

## 10. Value at Risk (VaR)

Historical VaR using the empirical percentile method:

```
VaR_α = (1-α) percentile of historical return distribution
```

- Default confidence: 95%
- Nearest-rank percentile convention
- Returns a positive percentage representing the loss threshold
- **This is an estimate based on historical data, not a guaranteed maximum loss**

### Conditional VaR (CVaR / Expected Shortfall)

```
CVaR = mean of returns below VaR threshold
```

Represents the expected loss given that losses exceed VaR.

## 11. Risk Scoring Methodology

### Normalization

Each metric is linearly mapped to 0–100 using reference ranges:

| Metric | Low (→ 0) | High (→ 100) |
|---|---|---|
| Annualized Volatility | 10% | 60% |
| Max Drawdown | 5% | 50% |
| Daily VaR (95%) | 1% | 6% |
| Sharpe Ratio | 2.0 (→ 0 risk) | -1.0 (→ 100 risk) |
| Beta deviation from 1.0 | 0.0 | 2.0 |

### Component Weights

| Component | Weight | Rationale |
|---|---|---|
| Volatility Risk | 30% | Primary risk indicator |
| Drawdown Risk | 25% | Worst-case capital loss |
| Value at Risk | 20% | Forward-looking loss estimate |
| Risk-Adjusted Return | 15% | Whether risk is compensated |
| Market Sensitivity | 10% | Benchmark correlation (redistributed when unavailable) |

When a metric is unavailable, its weight is redistributed proportionally among available components.

## 12. Score Interpretation

| Score | Classification |
|---|---|
| 0–20 | Very Low Risk |
| 21–40 | Low Risk |
| 41–60 | Moderate Risk |
| 61–80 | High Risk |
| 81–100 | Very High Risk |

## 13. Data Quality Rules

The API returns a `dataQuality` object:
- `observationCount`: number of valid price observations
- `sufficientHistory`: `true` if ≥30 observations
- `startDate` / `endDate`: date range of the data
- `frequency`: data frequency (daily for V1)
- `benchmarkAvailable`: `false` in V1
- `unavailableMetrics`: list of metrics that couldn't be calculated and why

Missing data produces `null` metrics and degraded quality indicators — never fake values.

## 14. Assumptions

| Assumption | Value |
|---|---|
| Risk-free rate | 6.5% (Indian 10-year govt bond, configurable) |
| Trading days per year | 252 |
| VaR confidence | 95% (configurable 90–99%) |
| Data source | Simulated (development mode) |

## 15. Known Limitations

1. **Simulated data**: All historical prices are generated deterministically, not sourced from real markets.
2. **No benchmark**: Beta is unavailable. Adding a real benchmark (e.g., Nifty 50) is architecturally straightforward.
3. **Float arithmetic**: Uses standard JavaScript `number` type. Acceptable for educational analysis but not for production financial calculations.
4. **Single-stock only**: Portfolio-level risk (correlation, diversification) is planned for a future phase.
5. **No Monte Carlo**: VaR uses purely historical simulation.
6. **Static history**: The seeded data doesn't update dynamically over time.

## 16. Future Improvements

- Real market data integration (replace simulated provider)
- Benchmark index (Nifty 50) for Beta calculation
- Portfolio-level risk analysis
- Monte Carlo VaR simulation
- Conditional risk metrics (sector-specific benchmarks)
- LLM-powered explanation of deterministic results (the LLM explains, never calculates)
- Risk alerts and monitoring
