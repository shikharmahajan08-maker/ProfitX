import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { stocks } from "../../drizzle/schema";
import { MARKET_STOCKS } from "@shared/marketData";

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
    }
  }
}
