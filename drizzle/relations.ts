import { relations } from "drizzle-orm";
import {
  users,
  stocks,
  marketData,
  portfolios,
  holdings,
  orders,
  transactions,
  watchlists,
  watchlistItems,
  alerts,
  portfolioSnapshots,
} from "./schema";

// ── Users ──────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ one, many }) => ({
  portfolio: one(portfolios, { fields: [users.id], references: [portfolios.userId] }),
  orders: many(orders),
  transactions: many(transactions),
  watchlists: many(watchlists),
  alerts: many(alerts),
}));

// ── Stocks ─────────────────────────────────────────────────────────────────
export const stocksRelations = relations(stocks, ({ many }) => ({
  marketData: many(marketData),
  holdings: many(holdings),
  orders: many(orders),
  transactions: many(transactions),
  watchlistItems: many(watchlistItems),
  alerts: many(alerts),
}));

// ── Market Data ────────────────────────────────────────────────────────────
export const marketDataRelations = relations(marketData, ({ one }) => ({
  stock: one(stocks, { fields: [marketData.stockId], references: [stocks.id] }),
}));

// ── Portfolios ─────────────────────────────────────────────────────────────
export const portfoliosRelations = relations(portfolios, ({ one, many }) => ({
  user: one(users, { fields: [portfolios.userId], references: [users.id] }),
  holdings: many(holdings),
  orders: many(orders),
  transactions: many(transactions),
  snapshots: many(portfolioSnapshots),
}));

// ── Holdings ───────────────────────────────────────────────────────────────
export const holdingsRelations = relations(holdings, ({ one }) => ({
  portfolio: one(portfolios, { fields: [holdings.portfolioId], references: [portfolios.id] }),
  stock: one(stocks, { fields: [holdings.stockId], references: [stocks.id] }),
}));

// ── Orders ─────────────────────────────────────────────────────────────────
export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  portfolio: one(portfolios, { fields: [orders.portfolioId], references: [portfolios.id] }),
  stock: one(stocks, { fields: [orders.stockId], references: [stocks.id] }),
  transactions: many(transactions),
}));

// ── Transactions ───────────────────────────────────────────────────────────
export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  portfolio: one(portfolios, { fields: [transactions.portfolioId], references: [portfolios.id] }),
  stock: one(stocks, { fields: [transactions.stockId], references: [stocks.id] }),
  order: one(orders, { fields: [transactions.orderId], references: [orders.id] }),
}));

// ── Watchlists ─────────────────────────────────────────────────────────────
export const watchlistsRelations = relations(watchlists, ({ one, many }) => ({
  user: one(users, { fields: [watchlists.userId], references: [users.id] }),
  items: many(watchlistItems),
}));

export const watchlistItemsRelations = relations(watchlistItems, ({ one }) => ({
  watchlist: one(watchlists, { fields: [watchlistItems.watchlistId], references: [watchlists.id] }),
  stock: one(stocks, { fields: [watchlistItems.stockId], references: [stocks.id] }),
}));

// ── Alerts ─────────────────────────────────────────────────────────────────
export const alertsRelations = relations(alerts, ({ one }) => ({
  user: one(users, { fields: [alerts.userId], references: [users.id] }),
  stock: one(stocks, { fields: [alerts.stockId], references: [stocks.id] }),
}));

// ── Portfolio Snapshots ────────────────────────────────────────────────────
export const portfolioSnapshotsRelations = relations(portfolioSnapshots, ({ one }) => ({
  portfolio: one(portfolios, { fields: [portfolioSnapshots.portfolioId], references: [portfolios.id] }),
}));
