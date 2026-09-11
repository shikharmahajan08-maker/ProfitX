import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { registerUser, loginUser, verifyToken } from "./services/authService";
import { users, portfolios } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

describe("Auth Integration", () => {
  let db: any;
  let isDbAvailable = false;
  const testEmail = "auth.integration@test.com";
  let testUserId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      console.warn("Database not available, skipping auth integration tests");
      return;
    }

    try {
      await db.select({ id: users.id }).from(users).limit(1);
      isDbAvailable = true;
    } catch (error) {
      console.warn("Database connection failed, skipping auth integration tests", error);
      db = null;
      return;
    }

    // Clean up
    await db.delete(users).where(eq(users.email, testEmail));
  });

  afterAll(async () => {
    if (db && testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it("should create user and portfolio atomically, hashing password, assigning cash", async () => {
    if (!isDbAvailable) return;
    
    const result = await registerUser("Auth Test", testEmail, "testpassword123");
    expect(result.success).toBe(true);
    if (!result.success) return;
    
    testUserId = result.user.id;

    const userRows = await db.select().from(users).where(eq(users.id, testUserId));
    expect(userRows.length).toBe(1);
    const user = userRows[0];
    
    // Password is hashed and plaintext is not stored
    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash).not.toBe("testpassword123");
    const isHashValid = await bcrypt.compare("testpassword123", user.passwordHash);
    expect(isHashValid).toBe(true);

    const portfolioRows = await db.select().from(portfolios).where(eq(portfolios.userId, testUserId));
    expect(portfolioRows.length).toBe(1);
    
    // Initial virtual cash is assigned correctly
    const expectedCash = process.env.INITIAL_VIRTUAL_CASH || "1000000.00";
    expect(parseFloat(portfolioRows[0].cashBalance)).toBe(parseFloat(expectedCash));
  });

  it("should reject duplicate email registration", async () => {
    if (!isDbAvailable) return;
    const result = await registerUser("Auth Test Dup", testEmail, "testpassword123");
    expect(result.success).toBe(false);
  });

  it("should succeed login with correct password", async () => {
    if (!isDbAvailable) return;
    const result = await loginUser(testEmail, "testpassword123");
    expect(result.success).toBe(true);
    if (result.success) {
      // Auth/session behavior works as intended via token
      const tokenPayload = await verifyToken(result.token);
      expect(tokenPayload).toBeDefined();
      expect(tokenPayload?.userId).toBe(testUserId);
    }
  });

  it("should fail login with incorrect password", async () => {
    if (!isDbAvailable) return;
    const result = await loginUser(testEmail, "wrongpassword");
    expect(result.success).toBe(false);
  });
});
