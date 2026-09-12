import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { stocks, marketData } from "../../drizzle/schema";
import { MARKET_STOCKS } from "@shared/marketData";

/**
 * Sync development market stocks into the database.
 * Idempotent: skips stocks that already exist.
 * Also seeds historical market_data (OHLCV) for the risk engine.
 */
export async function syncMarketStocks() {
  const db = await getDb();
  if (!db) return;

  for (const stock of MARKET_STOCKS) {
    const existing = await db
      .select({ id: stocks.id })
      .from(stocks)
      .where(eq(stocks.symbol, stock.symbol))
      .limit(1);

    if (existing.length === 0) {
      // Insert if not exists
      await db.insert(stocks).values({
        symbol: stock.symbol,
        companyName: stock.companyName,
        exchange: "NSE",
        sector: stock.sector,
        currentPrice: stock.price.toFixed(2),
        previousClose: stock.previousClose.toFixed(2),
        dayHigh: stock.dayHigh.toFixed(2),
        dayLow: stock.dayLow.toFixed(2),
        week52High: (stock.dayHigh * 1.2).toFixed(2), // Mock
        week52Low: (stock.dayLow * 0.8).toFixed(2),   // Mock
        volume: stock.volume,
      });

      // After inserting the new stock, get its ID
      const inserted = await db
        .select({ id: stocks.id })
        .from(stocks)
        .where(eq(stocks.symbol, stock.symbol))
        .limit(1);

      if (inserted.length > 0) {
        await seedHistoricalData(db, inserted[0].id, stock);
      }
    } else {
      // Update prices for dev simulation
      await db.update(stocks)
        .set({
          currentPrice: stock.price.toFixed(2),
          previousClose: stock.previousClose.toFixed(2),
          dayHigh: stock.dayHigh.toFixed(2),
          dayLow: stock.dayLow.toFixed(2),
          volume: stock.volume,
        })
        .where(eq(stocks.id, existing[0].id));

      // Seed historical data if not yet present
      await seedHistoricalData(db, existing[0].id, stock);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Historical Data Seeder
// ───────────────────────────────────────────────────────────────────────────

interface StockInfo {
  symbol: string;
  price: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  week52High: number;
  week52Low: number;
  volume: number;
}

/**
 * Seed ~252 daily OHLCV records into market_data for the risk engine.
 *
 * Uses a deterministic algorithm seeded by the stock's properties to produce
 * realistic-looking daily candles. This is simulated data for the development
 * environment — NOT real market data.
 *
 * Idempotent: skips if historical data already exists for this stock.
 */
async function seedHistoricalData(
  db: ReturnType<typeof import("drizzle-orm/mysql2").drizzle>,
  stockId: number,
  stock: StockInfo,
): Promise<void> {
  // Check if data already exists
  const existingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(marketData)
    .where(eq(marketData.stockId, stockId));

  const count = Number(existingCount[0]?.count ?? 0);
  if (count >= 100) return; // Already seeded

  const DAYS = 252; // ~1 trading year
  const now = new Date();
  const currentPrice = stock.price;

  // Create a deterministic seed from the symbol
  const seed = hashSymbol(stock.symbol);

  // Generate daily prices using a mean-reverting random walk
  // seeded deterministically from the stock's properties
  const dailyPrices = generateDeterministicPrices(
    currentPrice,
    stock.week52Low,
    stock.week52High,
    DAYS,
    seed,
  );

  // Insert in batches of 50 for performance
  const BATCH_SIZE = 50;
  for (let batch = 0; batch < dailyPrices.length; batch += BATCH_SIZE) {
    const batchData = dailyPrices.slice(batch, batch + BATCH_SIZE);
    const rows = batchData.map((dayData, batchIndex) => {
      const dayIndex = batch + batchIndex;
      // Work backwards from today
      const date = new Date(now);
      date.setDate(date.getDate() - (DAYS - dayIndex));
      // Skip weekends for realistic trading days
      while (date.getDay() === 0 || date.getDay() === 6) {
        date.setDate(date.getDate() - 1);
      }

      return {
        stockId,
        timestamp: date,
        open: dayData.open.toFixed(2),
        high: dayData.high.toFixed(2),
        low: dayData.low.toFixed(2),
        close: dayData.close.toFixed(2),
        volume: Math.round(
          stock.volume * (0.6 + pseudoRandom(seed + dayIndex * 7) * 0.8),
        ),
      };
    });

    await db.insert(marketData).values(rows);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Deterministic Price Generation
// ───────────────────────────────────────────────────────────────────────────

interface DayCandle {
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Generate deterministic daily OHLCV prices using a seeded pseudo-random walk.
 *
 * The algorithm uses:
 * - Mean-reverting drift (price tends toward the current price over time)
 * - Volatility scaled to the stock's 52-week range
 * - Deterministic seeding so the same stock always produces the same history
 *
 * This is NOT real market data. It is simulated for the development environment.
 */
function generateDeterministicPrices(
  currentPrice: number,
  week52Low: number,
  week52High: number,
  days: number,
  seed: number,
): DayCandle[] {
  const candles: DayCandle[] = [];

  // Estimate daily volatility from the 52-week range
  // Using the Parkinson volatility estimator concept
  const range = week52High - week52Low;
  const dailyVol = (range / currentPrice) / Math.sqrt(252) * 0.7;

  // Start price: roughly where the stock was ~1 year ago
  let price = currentPrice * (0.85 + pseudoRandom(seed) * 0.3);

  // Mean-reversion target is the current price
  const target = currentPrice;
  const reversionSpeed = 0.005; // How quickly price reverts to target

  for (let i = 0; i < days; i++) {
    const r1 = pseudoRandom(seed + i * 3 + 1);
    const r2 = pseudoRandom(seed + i * 3 + 2);
    const r3 = pseudoRandom(seed + i * 3 + 3);

    // Box-Muller-ish transform using the deterministic pseudo-random
    const normalish = (r1 - 0.5) * 2 + (r2 - 0.5) * 1.5;

    // Mean-reverting return
    const drift = reversionSpeed * (target - price) / price;
    const dailyReturn = drift + dailyVol * normalish;

    const open = price;
    const close = Math.max(1, price * (1 + dailyReturn));

    // High/Low: extend beyond open/close
    const spread = Math.abs(close - open);
    const high = Math.max(open, close) + spread * (0.2 + r3 * 0.8);
    const low = Math.min(open, close) - spread * (0.2 + r1 * 0.6);

    candles.push({
      open: Number(open.toFixed(2)),
      high: Number(Math.max(high, Math.max(open, close)).toFixed(2)),
      low: Number(Math.max(1, Math.min(low, Math.min(open, close))).toFixed(2)),
      close: Number(close.toFixed(2)),
    });

    price = close;
  }

  return candles;
}

/**
 * Deterministic pseudo-random number generator.
 * Returns a value in [0, 1) for any given seed.
 * Uses a simple hash-based approach for reproducibility.
 */
function pseudoRandom(seed: number): number {
  let x = Math.sin(seed * 12345.6789 + 7.89) * 43758.5453;
  x = x - Math.floor(x);
  return Math.abs(x);
}

/**
 * Simple deterministic hash of a stock symbol string to a number.
 */
function hashSymbol(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    const char = symbol.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) + 1;
}
