import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { watchlists, watchlistItems, stocks } from "../../drizzle/schema";
import { MARKET_STOCKS } from "@shared/marketData";

// ---------------------------------------------------------------------------
// Get user's default watchlist (create if not exists)
// ---------------------------------------------------------------------------

async function getOrCreateDefaultWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const existing = await db
    .select()
    .from(watchlists)
    .where(and(eq(watchlists.userId, userId), eq(watchlists.name, "Default")))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const result = await db.insert(watchlists).values({
    userId,
    name: "Default",
  });

  return { id: result[0].insertId, userId, name: "Default", createdAt: new Date(), updatedAt: new Date() };
}

// ---------------------------------------------------------------------------
// Get watchlist symbols for a user
// ---------------------------------------------------------------------------

export async function getWatchlistSymbols(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const watchlist = await getOrCreateDefaultWatchlist(userId);
  if (!watchlist) return [];

  const items = await db
    .select({ symbol: stocks.symbol })
    .from(watchlistItems)
    .innerJoin(stocks, eq(watchlistItems.stockId, stocks.id))
    .where(eq(watchlistItems.watchlistId, watchlist.id));

  return items.map((item) => item.symbol);
}

// ---------------------------------------------------------------------------
// Add to watchlist
// ---------------------------------------------------------------------------

export async function addToWatchlist(userId: number, symbol: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const watchlist = await getOrCreateDefaultWatchlist(userId);
  if (!watchlist) return { success: false, error: "Could not create watchlist" };

  const stockResult = await db
    .select({ id: stocks.id })
    .from(stocks)
    .where(eq(stocks.symbol, symbol.toUpperCase()))
    .limit(1);

  if (stockResult.length === 0) return { success: false, error: "Stock not found" };
  const realStockId = stockResult[0].id;

  try {
    await db.insert(watchlistItems).values({
      watchlistId: watchlist.id,
      stockId: realStockId,
    });
    return { success: true };
  } catch {
    // Likely duplicate
    return { success: false, error: "Stock already in watchlist" };
  }
}

// ---------------------------------------------------------------------------
// Remove from watchlist
// ---------------------------------------------------------------------------

export async function removeFromWatchlist(userId: number, symbol: string): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) return { success: false };

  const watchlist = await getOrCreateDefaultWatchlist(userId);
  if (!watchlist) return { success: false };

  const stockResult = await db
    .select({ id: stocks.id })
    .from(stocks)
    .where(eq(stocks.symbol, symbol.toUpperCase()))
    .limit(1);

  if (stockResult.length === 0) return { success: false };
  const realStockId = stockResult[0].id;

  await db
    .delete(watchlistItems)
    .where(
      and(
        eq(watchlistItems.watchlistId, watchlist.id),
        eq(watchlistItems.stockId, realStockId),
      ),
    );

  return { success: true };
}
