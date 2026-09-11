# ProfitX — Paper Trading & Portfolio Foundation

ProfitX is a production-minded V1 foundation for an educational paper-trading platform. It provides a user with a protected workspace, configurable virtual starting capital (default ₹1,000,000), simulated market data, stock research, market orders, holdings, P&L tracking, watchlists, development news, and price alerts.

**This is not a real-money trading application.** No broker, payment gateway, exchange, or live order book is connected. Market data in the V1 interface is strictly for development and simulation.

## V1 Features & Architecture

- **Authentication & Security:** Local demo registration, login, and persistent sessions. Uses bcrypt for password hashing and secure JWTs for authentication. Helmet, CORS, and rate limiting are configured.
- **Database-Backed Financial State:** All financial state (cash, invested value, current value, unrealized P&L, return percentages, holdings, orders, and transactions) is calculated and persisted in a MySQL database.
- **Transactional Trading Engine:** Trading engine uses robust database transactions with row-level `FOR UPDATE` locking to prevent race conditions during portfolio and holding updates.
- **Idempotency:** Order execution is strictly idempotent, protected by a composite unique constraint `(userId, idempotencyKey)` and within-transaction checks to safely handle duplicate network requests.
- **Paper Trading:** BUY/SELL market orders with strict server-side validation against fractional shares (whole shares only), insufficient cash, and insufficient holdings. Full SELL operations correctly remove holdings.
- **Market Data & Discovery:** Provider-neutral simulated market data service boundary. Includes symbol/company search, quotes, historical charts, watchlists, and basic price alerts.
- **Normalized Schema:** Drizzle ORM schema defining users, stocks, market data, portfolios, holdings, orders, transactions, watchlists, news, alerts, and portfolio snapshots.

## Tech Stack

React 19, TypeScript, Vite, Tailwind CSS 4, Zustand (UI state only), Recharts, Express, tRPC, Drizzle ORM, MySQL, and Vitest.

## Testing

The foundation includes robust integration tests using a real database to verify the atomic creation of users and portfolios, password hashing, and the transactional trading engine (cash deductions, holding updates, idempotency checks, and invalid trade rejections).

## Setup & Development

```bash
pnpm install
cp .env.example .env
# Edit .env with your MySQL connection string
pnpm drizzle-kit generate
pnpm run db:push
pnpm check
pnpm test
pnpm build
pnpm dev
```

## Paper-Trading Disclaimer

All balances, holdings, order executions, portfolio values, and P&L in this project are simulated. They do not represent real exchange demand, real brokerage execution, or financial advice. Replace the development market provider with a verified licensed source before any production use.
