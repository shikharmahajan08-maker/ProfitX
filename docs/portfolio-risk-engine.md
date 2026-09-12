# Deterministic Portfolio Risk Engine

The Portfolio Risk Engine (Phase 3) builds upon the single-stock primitives developed in Phase 2. It introduces mathematical aggregation to measure how assets interact with each other, focusing heavily on correlation and deterministic covariance.

## Core Assumptions
- **Constant Weight Assumption**: For point-in-time risk analysis, the engine applies the portfolio's *current* weights to historical market data. It does not attempt to simulate historical rebalancing or trading events.
- **Cash Treatment**: Portfolio risk metrics describe only the *invested* (risky-asset) sleeve of the portfolio. Cash is treated as a zero-volatility buffer and its relative weight is exposed, but covariance mapping is normalized across active investments to ensure percentage risk contributions correctly sum to 100%.
- **Missing Data Exclusion & Minimums**: To ensure covariance mathematical validity, the engine intersects dates. A strict minimum of 30 overlapping historical observations is enforced. If any held stock lacks this history, the engine refuses to calculate a deceptive aggregate score.
- **No Benchmarks for Beta**: Unless a specific benchmark is provided, Beta defaults to `null` to avoid fabricating correlation data.

## Key Portfolio Metrics

### Portfolio Volatility ($w^T \Sigma w$)
Unlike simple averaging, portfolio variance accounts for the correlation between assets.
1. Computes the covariance matrix ($\Sigma$) from aligned synchronous daily returns.
2. $\sigma_p^2 = \sum_{i} \sum_{j} w_i w_j \Sigma_{i,j}$
3. $\sigma_p = \sqrt{\sigma_p^2} \times \sqrt{252}$

### Risk Contribution
Stand-alone volatility doesn't tell the whole story. A highly volatile stock that is negatively correlated with the rest of the portfolio might actually *reduce* total portfolio risk.
- **Marginal Contribution to Risk (MCR)**: $MCR_i = \frac{(\Sigma w)_i}{\sigma_p}$
- **Percentage Risk Contribution**: $\frac{w_i \times MCR_i}{\sigma_p}$
- The sum of all percentage risk contributions mathematically equals 100%.

### Diversification Metrics
- **Herfindahl-Hirschman Index (HHI)**: $\sum w_i^2$. Measures concentration. A value of $1.0$ means $100\%$ concentrated in one asset.
- **Effective Number of Holdings (ENH)**: $1 / HHI$. A portfolio with $10$ stocks heavily skewed into $1$ might only have an ENH of $2.5$.

## Scoring System
The engine generates a deterministic 0–100 risk score based on ProfitX's specific heuristic thresholds:
- **Portfolio Volatility (35%)**: 5% (Low Risk) to 35% (High Risk)
- **Max Drawdown (25%)**: 5% (Low Risk) to 40% (High Risk)
- **VaR (20%)**: 1% (Low Risk) to 4% (High Risk)
- **Sharpe Ratio (10%)**: 1.5+ (Low Risk) to 0.0 (High Risk)
- **Concentration Penalty (10%)**: Scales up as HHI approaches 0.60.

If a metric is mathematically unavailable, its weight drops to zero and the remainder scales proportionally.

## What-If Stress Testing
Deterministic static shock analysis:
- Applies a static `-10%` or `-50%` mathematical shock to either the entire portfolio or the largest holding, computing the exact nominal and percentage loss. No Monte Carlo simulations are used.
