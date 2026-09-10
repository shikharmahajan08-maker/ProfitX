import { calculateAverageBuyPrice, calculateHoldingMetrics, calculatePortfolioSummary } from "@shared/trading";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { portfolios, holdings, stocks } from "../../drizzle/schema";

export { calculateAverageBuyPrice, calculateHoldingMetrics, calculatePortfolioSummary };

export function validateQuantity(quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }
}

export function validateTradeBalance(side: "BUY" | "SELL", cashBalance: number, holdingQuantity: number, quantity: number, price: number) {
  validateQuantity(quantity);
  if (price <= 0) throw new Error("Price must be greater than zero");
  if (side === "BUY" && cashBalance < quantity * price) throw new Error("Insufficient balance");
  if (side === "SELL" && holdingQuantity < quantity) throw new Error("Insufficient holdings");
}

export async function getUserPortfolioState(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const portfolioResult = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .limit(1);

  if (portfolioResult.length === 0) {
    return { cashBalance: 0, holdings: [] };
  }

  const portfolio = portfolioResult[0];

  const holdingsResult = await db
    .select({
      id: holdings.id,
      quantity: holdings.quantity,
      averageBuyPrice: holdings.averageBuyPrice,
      symbol: stocks.symbol,
    })
    .from(holdings)
    .innerJoin(stocks, eq(holdings.stockId, stocks.id))
    .where(eq(holdings.portfolioId, portfolio.id));

  return {
    cashBalance: parseFloat(portfolio.cashBalance),
    holdings: holdingsResult.map((h) => ({
      symbol: h.symbol,
      quantity: parseFloat(h.quantity),
      averageBuyPrice: parseFloat(h.averageBuyPrice),
    })),
  };
}
