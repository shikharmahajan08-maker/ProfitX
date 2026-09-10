import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { alerts } from "../../drizzle/schema";
import { MARKET_STOCKS } from "@shared/marketData";

// ---------------------------------------------------------------------------
// Get user alerts
// ---------------------------------------------------------------------------

export async function getUserAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(alerts)
    .where(eq(alerts.userId, userId));
}

// ---------------------------------------------------------------------------
// Create alert
// ---------------------------------------------------------------------------

export async function createAlert(
  userId: number,
  symbol: string,
  alertType: "PRICE_ABOVE" | "PRICE_BELOW",
  targetValue: number,
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  if (targetValue <= 0) return { success: false, error: "Target value must be positive" };

  const stockIndex = MARKET_STOCKS.findIndex((s) => s.symbol === symbol.toUpperCase());
  if (stockIndex === -1) return { success: false, error: "Stock not found" };

  await db.insert(alerts).values({
    userId,
    stockId: stockIndex,
    alertType,
    targetValue: targetValue.toFixed(2),
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Toggle alert active/inactive
// ---------------------------------------------------------------------------

export async function toggleAlert(
  userId: number,
  alertId: number,
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  // Verify ownership
  const existing = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .limit(1);

  if (existing.length === 0) return { success: false, error: "Alert not found" };

  const alert = existing[0];
  await db
    .update(alerts)
    .set({ isActive: !alert.isActive })
    .where(eq(alerts.id, alertId));

  return { success: true };
}

// ---------------------------------------------------------------------------
// Delete alert (with ownership check)
// ---------------------------------------------------------------------------

export async function deleteAlert(
  userId: number,
  alertId: number,
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const existing = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .limit(1);

  if (existing.length === 0) return { success: false, error: "Alert not found or unauthorized" };

  await db
    .delete(alerts)
    .where(eq(alerts.id, alertId));

  return { success: true };
}
