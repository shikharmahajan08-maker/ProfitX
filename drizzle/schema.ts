import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// ═══════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 256 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ═══════════════════════════════════════════════════════════════════════════
// STOCKS
// ═══════════════════════════════════════════════════════════════════════════

export const stocks = mysqlTable("stocks", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 16 }).notNull().unique(),
  companyName: varchar("companyName", { length: 160 }).notNull(),
  exchange: varchar("exchange", { length: 32 }).notNull(),
  sector: varchar("sector", { length: 80 }).notNull(),
  industry: varchar("industry", { length: 120 }),
  currentPrice: decimal("currentPrice", { precision: 14, scale: 2 }).notNull(),
  previousClose: decimal("previousClose", { precision: 14, scale: 2 }).notNull(),
  dayHigh: decimal("dayHigh", { precision: 14, scale: 2 }).notNull(),
  dayLow: decimal("dayLow", { precision: 14, scale: 2 }).notNull(),
  week52High: decimal("week52High", { precision: 14, scale: 2 }).notNull(),
  week52Low: decimal("week52Low", { precision: 14, scale: 2 }).notNull(),
  volume: int("volume").notNull(),
  marketCap: decimal("marketCap", { precision: 18, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sectorIdx: index("stocks_sector_idx").on(table.sector),
}));

// ═══════════════════════════════════════════════════════════════════════════
// MARKET DATA (OHLCV)
// ═══════════════════════════════════════════════════════════════════════════

export const marketData = mysqlTable("market_data", {
  id: int("id").autoincrement().primaryKey(),
  stockId: int("stockId").notNull().references(() => stocks.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").notNull(),
  open: decimal("open", { precision: 14, scale: 2 }).notNull(),
  high: decimal("high", { precision: 14, scale: 2 }).notNull(),
  low: decimal("low", { precision: 14, scale: 2 }).notNull(),
  close: decimal("close", { precision: 14, scale: 2 }).notNull(),
  volume: int("volume").notNull(),
}, (table) => ({
  stockDateIdx: index("market_data_stock_date_idx").on(table.stockId, table.timestamp),
}));

// ═══════════════════════════════════════════════════════════════════════════
// PORTFOLIOS
// ═══════════════════════════════════════════════════════════════════════════

export const portfolios = mysqlTable("portfolios", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  cashBalance: decimal("cashBalance", { precision: 16, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ═══════════════════════════════════════════════════════════════════════════
// HOLDINGS
// ═══════════════════════════════════════════════════════════════════════════

export const holdings = mysqlTable("holdings", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolioId").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  stockId: int("stockId").notNull().references(() => stocks.id, { onDelete: "restrict" }),
  quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull(),
  averageBuyPrice: decimal("averageBuyPrice", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueHolding: uniqueIndex("holdings_portfolio_stock_unique").on(table.portfolioId, table.stockId),
}));

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  idempotencyKey: varchar("idempotencyKey", { length: 64 }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  portfolioId: int("portfolioId").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  stockId: int("stockId").notNull().references(() => stocks.id, { onDelete: "restrict" }),
  side: mysqlEnum("side", ["BUY", "SELL"]).notNull(),
  orderType: mysqlEnum("orderType", ["MARKET", "LIMIT", "STOP_LOSS", "STOP_LIMIT"]).default("MARKET").notNull(),
  quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull(),
  requestedPrice: decimal("requestedPrice", { precision: 14, scale: 2 }).notNull(),
  executedPrice: decimal("executedPrice", { precision: 14, scale: 2 }),
  totalAmount: decimal("totalAmount", { precision: 16, scale: 2 }),
  status: mysqlEnum("status", ["PENDING", "EXECUTED", "CANCELLED", "REJECTED"]).default("PENDING").notNull(),
  rejectionReason: varchar("rejectionReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userCreatedIdx: index("orders_user_created_idx").on(table.userId, table.createdAt),
  idempotencyIdx: uniqueIndex("orders_user_idempotency_idx").on(table.userId, table.idempotencyKey),
}));

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTIONS (executed trades — immutable ledger)
// ═══════════════════════════════════════════════════════════════════════════

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  portfolioId: int("portfolioId").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  stockId: int("stockId").notNull().references(() => stocks.id, { onDelete: "restrict" }),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "restrict" }),
  type: mysqlEnum("transaction_type", ["BUY", "SELL"]).notNull(),
  quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull(),
  price: decimal("price", { precision: 14, scale: 2 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 16, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userCreatedIdx: index("transactions_user_created_idx").on(table.userId, table.createdAt),
}));

// ═══════════════════════════════════════════════════════════════════════════
// WATCHLISTS
// ═══════════════════════════════════════════════════════════════════════════

export const watchlists = mysqlTable("watchlists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userNameUnique: uniqueIndex("watchlists_user_name_unique").on(table.userId, table.name),
}));

export const watchlistItems = mysqlTable("watchlist_items", {
  id: int("id").autoincrement().primaryKey(),
  watchlistId: int("watchlistId").notNull().references(() => watchlists.id, { onDelete: "cascade" }),
  stockId: int("stockId").notNull().references(() => stocks.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueItem: uniqueIndex("watchlist_items_watchlist_stock_unique").on(table.watchlistId, table.stockId),
}));

// ═══════════════════════════════════════════════════════════════════════════
// NEWS
// ═══════════════════════════════════════════════════════════════════════════

export const news = mysqlTable("news", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 220 }).notNull(),
  description: text("description").notNull(),
  source: varchar("source", { length: 80 }).notNull(),
  url: varchar("url", { length: 500 }),
  publishedAt: timestamp("publishedAt").notNull(),
  sector: varchar("sector", { length: 80 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  publishedIdx: index("news_published_idx").on(table.publishedAt),
  sectorIdx: index("news_sector_idx").on(table.sector),
}));

// ═══════════════════════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════════════════════

export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  stockId: int("stockId").notNull().references(() => stocks.id, { onDelete: "cascade" }),
  alertType: mysqlEnum("alert_type", ["PRICE_ABOVE", "PRICE_BELOW"]).notNull(),
  targetValue: decimal("targetValue", { precision: 14, scale: 2 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  triggeredAt: timestamp("triggeredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userActiveIdx: index("alerts_user_active_idx").on(table.userId, table.isActive),
}));

// ═══════════════════════════════════════════════════════════════════════════
// PORTFOLIO SNAPSHOTS (for historical analytics)
// ═══════════════════════════════════════════════════════════════════════════

export const portfolioSnapshots = mysqlTable("portfolio_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolioId").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  totalValue: decimal("totalValue", { precision: 16, scale: 2 }).notNull(),
  cashValue: decimal("cashValue", { precision: 16, scale: 2 }).notNull(),
  investedValue: decimal("investedValue", { precision: 16, scale: 2 }).notNull(),
  pnl: decimal("pnl", { precision: 16, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
}, (table) => ({
  portfolioTimeIdx: index("snapshots_portfolio_time_idx").on(table.portfolioId, table.timestamp),
}));

// ═══════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Stock = typeof stocks.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Portfolio = typeof portfolios.$inferSelect;
export type WatchlistRecord = typeof watchlists.$inferSelect;
export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
