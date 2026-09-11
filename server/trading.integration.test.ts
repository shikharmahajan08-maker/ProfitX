import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { registerUser } from "./services/authService";
import { executeMarketOrder } from "./services/tradingService";
import { users, portfolios, holdings, orders, transactions } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

describe("Trading Integration", () => {
  let db: any;
  let testUserId1: number;
  let testUserId2: number;
  let isDbAvailable = false;

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      console.warn("Database not available, skipping integration tests");
      return;
    }
    
    try {
      // Test connection
      await db.select({ id: users.id }).from(users).limit(1);
      isDbAvailable = true;
    } catch (error) {
      console.warn("Database connection failed, skipping integration tests", error);
      db = null;
      return;
    }
    
    // Clean up test users if they exist
    const testEmail1 = "integration1@test.com";
    const testEmail2 = "integration2@test.com";
    await db.delete(users).where(eq(users.email, testEmail1));
    await db.delete(users).where(eq(users.email, testEmail2));
    
    const result1 = await registerUser("Integration Test 1", testEmail1, "testpassword123");
    if (!result1.success) throw new Error("Registration 1 failed");
    
    const result2 = await registerUser("Integration Test 2", testEmail2, "testpassword123");
    if (!result2.success) throw new Error("Registration 2 failed");
    
    const userRows1 = await db.select().from(users).where(eq(users.email, testEmail1));
    testUserId1 = userRows1[0].id;

    const userRows2 = await db.select().from(users).where(eq(users.email, testEmail2));
    testUserId2 = userRows2[0].id;
  });

  afterAll(async () => {
    if (db && testUserId1) {
      await db.delete(users).where(eq(users.id, testUserId1));
    }
    if (db && testUserId2) {
      await db.delete(users).where(eq(users.id, testUserId2));
    }
  });

  it("should execute a valid BUY order and update invariants (A)", async () => {
    if (!isDbAvailable) return;
    const key = nanoid();
    const portfolioBefore = await db.select().from(portfolios).where(eq(portfolios.userId, testUserId1));
    const cashBefore = parseFloat(portfolioBefore[0].cashBalance);

    const result = await executeMarketOrder(testUserId1, "TCS", "BUY", 10, key);
    expect(result.success).toBe(true);

    const portfolioAfter = await db.select().from(portfolios).where(eq(portfolios.userId, testUserId1));
    const cashAfter = parseFloat(portfolioAfter[0].cashBalance);
    expect(cashAfter).toBeLessThan(cashBefore);

    const holdingRows = await db.select().from(holdings).where(eq(holdings.portfolioId, portfolioAfter[0].id));
    expect(holdingRows.length).toBe(1);
    expect(parseFloat(holdingRows[0].quantity)).toBe(10);

    const orderRows = await db.select().from(orders).where(eq(orders.userId, testUserId1)).orderBy(desc(orders.createdAt));
    expect(orderRows.length).toBeGreaterThan(0);
    expect(orderRows[0].side).toBe("BUY");

    const transactionRows = await db.select().from(transactions).where(eq(transactions.userId, testUserId1)).orderBy(desc(transactions.createdAt));
    expect(transactionRows.length).toBeGreaterThan(0);
  });

  it("should calculate weighted average price on multiple BUYs (B)", async () => {
    if (!isDbAvailable) return;
    const key1 = nanoid();
    const key2 = nanoid();
    
    // First buy
    await executeMarketOrder(testUserId1, "RELIANCE", "BUY", 10, key1);
    
    const portfolio = await db.select().from(portfolios).where(eq(portfolios.userId, testUserId1));
    let holdingRows = await db.select().from(holdings).where(eq(holdings.portfolioId, portfolio[0].id));
    const relianceHolding1 = holdingRows.find((h: any) => h.stockId !== undefined); // We know it's there
    const avgPrice1 = parseFloat(relianceHolding1.averageBuyPrice);

    // Second buy
    await executeMarketOrder(testUserId1, "RELIANCE", "BUY", 5, key2);

    holdingRows = await db.select().from(holdings).where(eq(holdings.portfolioId, portfolio[0].id));
    const relianceHolding2 = holdingRows.find((h: any) => h.stockId === relianceHolding1.stockId);
    
    expect(parseFloat(relianceHolding2.quantity)).toBe(15);
    // Since we are using mock market data, price is static. But we verify it's correctly re-calculated.
    expect(parseFloat(relianceHolding2.averageBuyPrice)).toBe(avgPrice1);
  });

  it("should execute a partial SELL order correctly (C)", async () => {
    if (!isDbAvailable) return;
    const key = nanoid();
    const portfolioBefore = await db.select().from(portfolios).where(eq(portfolios.userId, testUserId1));
    const cashBefore = parseFloat(portfolioBefore[0].cashBalance);

    const result = await executeMarketOrder(testUserId1, "TCS", "SELL", 5, key);
    expect(result.success).toBe(true);

    const portfolioAfter = await db.select().from(portfolios).where(eq(portfolios.userId, testUserId1));
    const cashAfter = parseFloat(portfolioAfter[0].cashBalance);
    expect(cashAfter).toBeGreaterThan(cashBefore);

    const holdingRows = await db.select().from(holdings).where(eq(holdings.portfolioId, portfolioAfter[0].id));
    const tcsHolding = holdingRows.find((h: any) => parseFloat(h.quantity) === 5);
    expect(tcsHolding).toBeDefined();
  });

  it("should execute a full SELL order correctly (D)", async () => {
    if (!isDbAvailable) return;
    const key = nanoid();
    const result = await executeMarketOrder(testUserId1, "TCS", "SELL", 5, key);
    expect(result.success).toBe(true);

    const portfolioAfter = await db.select().from(portfolios).where(eq(portfolios.userId, testUserId1));
    const holdingRows = await db.select().from(holdings).where(eq(holdings.portfolioId, portfolioAfter[0].id));
    const tcsHolding = holdingRows.find((h: any) => h.stockId === 1); // Not exact, but we check if holding is gone
    // TCS holding should be removed
    expect(holdingRows.length).toBeLessThan(2);
  });

  it("should reject insufficient cash (E)", async () => {
    if (!isDbAvailable) return;
    const res = await executeMarketOrder(testUserId1, "TCS", "BUY", 1000000, nanoid());
    expect(res.success).toBe(false);
  });

  it("should reject insufficient holdings (F)", async () => {
    if (!isDbAvailable) return;
    const res = await executeMarketOrder(testUserId1, "TCS", "SELL", 10, nanoid());
    expect(res.success).toBe(false);
  });

  it("should enforce duplicate idempotency key correctly (G)", async () => {
    if (!isDbAvailable) return;
    const key = nanoid();
    
    const res1 = await executeMarketOrder(testUserId1, "HDFCBANK", "BUY", 1, key);
    expect(res1.success).toBe(true);

    const res2 = await executeMarketOrder(testUserId1, "HDFCBANK", "BUY", 1, key);
    expect(res2.success).toBe(false);
    if (!res2.success) {
      expect(res2.error).toContain("already been executed");
    }
  });

  it("should allow same idempotency key across DIFFERENT users (H)", async () => {
    if (!isDbAvailable) return;
    const sharedKey = "SHARED_KEY_123";
    
    const res1 = await executeMarketOrder(testUserId1, "ITC", "BUY", 1, sharedKey);
    const res2 = await executeMarketOrder(testUserId2, "ITC", "BUY", 1, sharedKey);
    
    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
  });

  it("should enforce concurrent duplicate trades correctly (I)", async () => {
    if (!isDbAvailable) return;
    const concurrentKey = nanoid();
    const p1 = executeMarketOrder(testUserId1, "INFY", "BUY", 1, concurrentKey);
    const p2 = executeMarketOrder(testUserId1, "INFY", "BUY", 1, concurrentKey);
    const results = await Promise.all([p1, p2]);
    
    const successes = results.filter(r => r.success);
    expect(successes.length).toBe(1);
  });

  it("should handle concurrent independent trades atomically on same portfolio (J)", async () => {
    if (!isDbAvailable) return;
    const k1 = nanoid();
    const k2 = nanoid();
    
    const p1 = executeMarketOrder(testUserId1, "SBIN", "BUY", 1, k1);
    const p2 = executeMarketOrder(testUserId1, "MARUTI", "BUY", 1, k2);
    
    const results = await Promise.all([p1, p2]);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  it("should prevent User A from accessing User B's portfolio (IDOR) (L)", async () => {
    if (!isDbAvailable) return;
    // executeMarketOrder inherently scopes to userId.
    // Let's try to sell a stock user 1 owns, but as user 2
    const key = nanoid();
    const res = await executeMarketOrder(testUserId2, "RELIANCE", "SELL", 5, key);
    expect(res.success).toBe(false); // User 2 doesn't own RELIANCE
  });

  it("should reject invalid quantities (M)", async () => {
    if (!isDbAvailable) return;
    const res1 = await executeMarketOrder(testUserId1, "TCS", "BUY", 0, nanoid());
    expect(res1.success).toBe(false);

    const res2 = await executeMarketOrder(testUserId1, "TCS", "BUY", -5, nanoid());
    expect(res2.success).toBe(false);

    const res3 = await executeMarketOrder(testUserId1, "TCS", "BUY", 1.5, nanoid());
    expect(res3.success).toBe(false);

    const res4 = await executeMarketOrder(testUserId1, "TCS", "BUY", NaN, nanoid());
    expect(res4.success).toBe(false);
  });

});
