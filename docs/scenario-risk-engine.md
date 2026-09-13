# Advanced Portfolio Scenario & What-If Risk Engine (Phase 4)

## Architecture
The Scenario Engine builds upon the Phase 3 Deterministic Portfolio Risk Engine. It allows users to answer "What happens to my portfolio if I change something?" without risking capital or blindly trusting opaque ML models. 

To maintain dry (Don't Repeat Yourself) compliance, the database hydration layer in Phase 3 was decoupled from the mathematical orchestrator.
Both the Phase 3 `analyzePortfolioRisk` and Phase 4 `analyzeScenario` functions now hydrate a `PortfolioSnapshot` and pass it to the same shared pure function: `calculateRiskFromSnapshot`.

## PortfolioSnapshot
The pure calculation pipeline operates on a `PortfolioSnapshot`:
```typescript
export interface PortfolioSnapshot {
  portfolioId: number;
  holdings: PortfolioHolding[];
  cashBalance: number;
  priceHistory: Record<string, { date: string; price: number }[]>;
}
```

## Pure Risk Calculation Pipeline
`calculateRiskFromSnapshot` guarantees that the hypothetical scenario and the baseline portfolio are calculated using the exact same mathematical implementations, including 30-day alignment checks, covariance matrices, and variance constraints.

## Scenario Transformations
Transformations are applied sequentially via immutable reducer functions. 
A deep clone of the holdings array is made. Price history is passed by reference since it is strictly read-only.

Supported transformations in V1:
- `market_shock`: Applies a direct percentage drop strictly to the invested/risky sleeve.
- `asset_shock`: Applies a direct percentage drop to a single asset's market value.
- `trade_value`: Buys or sells a specific INR amount of an asset, adjusting `cashBalance` and `marketValue`.
- `trade_percentage`: Sells a specific percentage of a holding's market value.
- `override_weight`: Calculates the target market value for a holding based on the total portfolio value and automatically performs a hypothetical BUY or SELL to reach the target weight using cash.

## Cash Semantics
- Cash acts as a zero-volatility buffer.
- Market shocks do not affect cash.
- Trades require sufficient cash. Negative cash balances are strictly banned (No Leverage).
- Short selling is strictly banned.

## Data-Quality Requirements
The hypothetical portfolio correctly inherits all Phase 3 data-quality rules. 
If a scenario completely liquidates a holding (e.g. 100% sell), that holding is removed from the active hypothetical holdings and will no longer constrain the historical aligned return dates of the remaining assets.

## Scenarios Intentionally Postponed
- Automatic portfolio optimization (maximize Sharpe, minimum volatility).
- Time-shifted backtesting.
- Dynamic ticker discovery (buying assets not currently in the DB).
- Leverage, margin, and derivatives (options).
- Monte Carlo / Machine Learning predictions.
