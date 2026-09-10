import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users, portfolios } from "../../drizzle/schema";
import { ENV } from "../_core/env";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SALT_ROUNDS = 12;
const JWT_ISSUER = "profitx";
const JWT_AUDIENCE = "profitx-client";
const JWT_EXPIRY = "30d";
const INITIAL_VIRTUAL_CASH = "1000000.00";

// ---------------------------------------------------------------------------
// JWT Secret — derived from ENV.cookieSecret or fallback for dev
// ---------------------------------------------------------------------------

function getJwtSecret(): Uint8Array {
  const secret = ENV.cookieSecret || "dev-secret-not-for-production-use";
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Token payload
// ---------------------------------------------------------------------------

interface SessionPayload extends JWTPayload {
  userId: number;
  openId: string;
  email: string | null;
  name: string | null;
  role: string;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<{ success: true; token: string; user: { id: number; name: string; email: string } } | { success: false; error: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database is not available." };

  // Normalize
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  // Validate
  if (!trimmedName) return { success: false, error: "Name is required." };
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return { success: false, error: "Invalid email address." };
  if (password.length < 8) return { success: false, error: "Password must be at least 8 characters." };

  // Check if email already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (existing.length > 0) return { success: false, error: "An account with this email already exists." };

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Generate a unique openId for email-registered users
  const openId = `email_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Insert user
  const insertResult = await db.insert(users).values({
    openId,
    name: trimmedName,
    email: normalizedEmail,
    passwordHash,
    loginMethod: "email",
    lastSignedIn: new Date(),
  });

  const userId = insertResult[0].insertId;

  // Create portfolio with initial virtual cash
  await db.insert(portfolios).values({
    userId,
    cashBalance: INITIAL_VIRTUAL_CASH,
  });

  // Create session token
  const token = await createToken({
    userId,
    openId,
    email: normalizedEmail,
    name: trimmedName,
    role: "user",
  });

  return {
    success: true,
    token,
    user: { id: userId, name: trimmedName, email: normalizedEmail },
  };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function loginUser(
  email: string,
  password: string,
): Promise<{ success: true; token: string; user: { id: number; name: string | null; email: string | null } } | { success: false; error: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database is not available." };

  const normalizedEmail = email.trim().toLowerCase();

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  const user = result[0];
  if (!user) return { success: false, error: "Invalid email or password." };
  if (!user.passwordHash) return { success: false, error: "This account uses OAuth. Please sign in with your provider." };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { success: false, error: "Invalid email or password." };

  // Update last sign-in
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));

  const token = await createToken({
    userId: user.id,
    openId: user.openId,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return {
    success: true,
    token,
    user: { id: user.id, name: user.name, email: user.email },
  };
}

// ---------------------------------------------------------------------------
// Token creation & verification
// ---------------------------------------------------------------------------

async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(JWT_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Get user by ID (for authenticated requests)
// ---------------------------------------------------------------------------

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return result[0] ?? null;
}
