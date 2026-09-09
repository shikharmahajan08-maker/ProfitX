import { desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, alerts, holdings, news, orders, portfolios, stocks, transactions, users, watchlistItems, watchlists } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb(); if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (['name', 'email', 'loginMethod'] as const).forEach((field) => { if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; } });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1); return result[0]; }
export async function searchStocks(query = "") { const db = await getDb(); if (!db) return []; const normalized = `%${query}%`; return db.select().from(stocks).where(or(like(stocks.symbol, normalized), like(stocks.companyName, normalized))).limit(40); }
export async function getRecentNews(limit = 20) { const db = await getDb(); if (!db) return []; return db.select().from(news).orderBy(desc(news.publishedAt)).limit(limit); }
export async function getUserPortfolio(userId: number) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1); return result[0]; }
export async function getUserHoldings(portfolioId: number) { const db = await getDb(); if (!db) return []; return db.select().from(holdings).where(eq(holdings.portfolioId, portfolioId)); }
export async function getUserOrders(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)); }
export async function getUserTransactions(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt)); }
export async function getUserWatchlist(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(watchlists).where(eq(watchlists.userId, userId)); }
export async function getWatchlistItems(watchlistId: number) { const db = await getDb(); if (!db) return []; return db.select().from(watchlistItems).where(eq(watchlistItems.watchlistId, watchlistId)); }
export async function getUserAlerts(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(alerts).where(eq(alerts.userId, userId)); }
