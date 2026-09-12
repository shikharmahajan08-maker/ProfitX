import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  portfolios,
  holdings,
  orders,
  transactions,
  stocks,
} from "../../drizzle/schema";
import { getStock } from "@shared/marketData";
import { calculateAverageBuyPrice } from "@shared/trading";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TradeResult =
  | { success: true; orderId: number; executedPrice: string; totalAmount: string; message: string }
  | { success: false; error: string };

type OrderSide = "BUY" | "SELL";

// ---------------------------------------------------------------------------
// Execute a MARKET order atomically
// ---------------------------------------------------------------------------

export async function executeMarketOrder(
  userId: number,
  symbol: string,
  side: OrderSide,
  quantity: number,
  idempotencyKey?: string,
): Promise<TradeResult> {
  // ── Input validation ────────────────────────────────────────────────
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { success: false, error: "Quantity must be a positive number." };
  }

  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database is not available." };
  }

  // ── Execute atomically using a transaction ──────────────────────────
  try {
    return await db.transaction(async (tx) => {
      // 1. Lock portfolio for update to prevent concurrent double-spends
      const lockedPortfolioResult = await tx.execute(
        sql`SELECT * FROM portfolios WHERE userId = ${userId} FOR UPDATE`,
      );

      const portfolioRows = (lockedPortfolioResult[0] as unknown) as any[];
      if (!portfolioRows || portfolioRows.length === 0) {
        throw new Error("VALIDATION_ERROR:Portfolio not found.");
      }
      const portfolio = portfolioRows[0];
      const portfolioId = portfolio.id;
      const cashBalance = parseFloat(portfolio.cashBalance);

      // 2. Idempotency check — INSIDE the transaction, after portfolio lock
      if (idempotencyKey) {
        const existingOrder = await tx
          .select({ id: orders.id, status: orders.status })
          .from(orders)
          .where(and(eq(orders.idempotencyKey, idempotencyKey), eq(orders.userId, userId)))
          .limit(1);

        if (existingOrder.length > 0) {
          const eo = existingOrder[0];
          if (eo.status === "EXECUTED") {
            throw new Error("VALIDATION_ERROR:This order has already been executed (duplicate idempotency key).");
          }
        }
      }

      // 3. Get real stock ID and current price from database
      const stockResult = await tx
        .select({ id: stocks.id, currentPrice: stocks.currentPrice })
        .from(stocks)
        .where(eq(stocks.symbol, symbol.toUpperCase()))
        .limit(1);

      if (stockResult.length === 0) {
        throw new Error("VALIDATION_ERROR:Stock not found in database.");
      }
      const realStockId = stockResult[0].id;
      const price = parseFloat(stockResult[0].currentPrice);

      // 4. Side-specific validation
      const totalAmount = price * quantity;
      const quantityStr = quantity.toFixed(4);
      const priceStr = price.toFixed(2);
      const totalStr = totalAmount.toFixed(2);

      if (side === "BUY") {
        if (cashBalance < totalAmount) {
          throw new Error(
            `VALIDATION_ERROR:Insufficient cash. Available: ₹${cashBalance.toFixed(2)}, Required: ₹${totalStr}`,
          );
        }
      }

      let existingHolding: any = null;

      if (side === "SELL") {
        // Lock the specific holding
        const lockedHoldingResult = await tx.execute(
          sql`SELECT * FROM holdings WHERE portfolioId = ${portfolioId} AND stockId = ${realStockId} FOR UPDATE`,
        );
        const holdingRows = (lockedHoldingResult[0] as unknown) as any[];
        if (!holdingRows || holdingRows.length === 0) {
          throw new Error("VALIDATION_ERROR:You do not own this stock.");
        }
        existingHolding = holdingRows[0];
        const ownedQty = parseFloat(existingHolding.quantity);
        if (ownedQty < quantity) {
          throw new Error(`VALIDATION_ERROR:Insufficient shares. You own ${ownedQty}.`);
        }
      }

      // 5. Create the order record
      const orderResult = await tx.insert(orders).values({
        idempotencyKey: idempotencyKey ?? null,
        userId,
        portfolioId,
        stockId: realStockId,
        side,
        orderType: "MARKET",
        quantity: quantityStr,
        requestedPrice: priceStr,
        executedPrice: priceStr,
        totalAmount: totalStr,
        status: "EXECUTED",
      });

      const orderId = orderResult[0].insertId;

      // 6. Update cash balance
      const newCash = side === "BUY" ? cashBalance - totalAmount : cashBalance + totalAmount;
      await tx
        .update(portfolios)
        .set({ cashBalance: newCash.toFixed(2) })
        .where(eq(portfolios.id, portfolioId));

      // 7. Update holdings
      if (side === "BUY") {
        const holdingCheck = await tx.execute(
          sql`SELECT * FROM holdings WHERE portfolioId = ${portfolioId} AND stockId = ${realStockId} FOR UPDATE`,
        );
        const checkRows = (holdingCheck[0] as unknown) as any[];
        if (checkRows && checkRows.length > 0) {
          const h = checkRows[0];
          const oldQty = parseFloat(h.quantity);
          const oldAvg = parseFloat(h.averageBuyPrice);
          const newAvg = calculateAverageBuyPrice(oldQty, oldAvg, quantity, price);
          const newQty = oldQty + quantity;

          await tx
            .update(holdings)
            .set({
              quantity: newQty.toFixed(4),
              averageBuyPrice: newAvg.toFixed(2),
            })
            .where(eq(holdings.id, h.id));
        } else {
          await tx.insert(holdings).values({
            portfolioId,
            stockId: realStockId,
            quantity: quantityStr,
            averageBuyPrice: priceStr,
          });
        }
      } else {
        // SELL — reduce or remove holding
        const ownedQty = parseFloat(existingHolding.quantity);
        const remainingQty = ownedQty - quantity;

        // Due to float precision, check against a small epsilon
        if (remainingQty <= 0.0001) {
          await tx.delete(holdings).where(eq(holdings.id, existingHolding.id));
        } else {
          await tx
            .update(holdings)
            .set({ quantity: remainingQty.toFixed(4) })
            .where(eq(holdings.id, existingHolding.id));
        }
      }

      // 8. Create transaction record
      await tx.insert(transactions).values({
        userId,
        portfolioId,
        stockId: realStockId,
        orderId,
        type: side,
        quantity: quantityStr,
        price: priceStr,
        totalAmount: totalStr,
      });

      return {
        success: true,
        orderId,
        executedPrice: priceStr,
        totalAmount: totalStr,
        message: `${side === "BUY" ? "Bought" : "Sold"} ${quantity} shares of ${symbol} at ₹${price.toLocaleString(
          "en-IN",
        )}`,
      } as TradeResult;
    });
  } catch (error: any) {
    if (error?.message?.startsWith("VALIDATION_ERROR:")) {
      return { success: false, error: error.message.replace("VALIDATION_ERROR:", "") };
    }
    console.error("[Trading] Order execution failed:", error);
    return { success: false, error: "Order execution failed. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Get user orders
// ---------------------------------------------------------------------------

export async function getUserOrders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const items = await db
    .select({
      id: orders.id,
      side: orders.side,
      quantity: orders.quantity,
      price: orders.executedPrice,
      total: orders.totalAmount,
      status: orders.status,
      createdAt: orders.createdAt,
      symbol: stocks.symbol,
    })
    .from(orders)
    .innerJoin(stocks, eq(orders.stockId, stocks.id))
    .where(eq(orders.userId, userId))
    .orderBy(sql`${orders.createdAt} DESC`)
    .limit(100);

  return items.map((item) => ({
    ...item,
    quantity: parseFloat(item.quantity),
    price: parseFloat(item.price ?? "0"),
    total: parseFloat(item.total ?? "0"),
  }));
}

// ---------------------------------------------------------------------------
// Get user transactions
// ---------------------------------------------------------------------------

export async function getUserTransactions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const items = await db
    .select({
      id: transactions.id,
      side: transactions.type,
      quantity: transactions.quantity,
      price: transactions.price,
      total: transactions.totalAmount,
      createdAt: transactions.createdAt,
      symbol: stocks.symbol,
    })
    .from(transactions)
    .innerJoin(stocks, eq(transactions.stockId, stocks.id))
    .where(eq(transactions.userId, userId))
    .orderBy(sql`${transactions.createdAt} DESC`)
    .limit(100);

  return items.map((item) => ({
    ...item,
    quantity: parseFloat(item.quantity),
    price: parseFloat(item.price),
    total: parseFloat(item.total),
  }));
}
