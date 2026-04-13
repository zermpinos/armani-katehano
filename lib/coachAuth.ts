/**
 * lib/coachAuth.ts
 *
 * Auth helpers for the coach portal — fully separate from the admin session.
 *
 * Cookie : __Host-ak_coach  (HttpOnly, Secure, SameSite=Strict, Path=/)
 * Secret : same SESSION_SECRET used for HMAC signing (key reuse is fine;
 *          the cookie name and role field prevent cross-session confusion)
 * Password: COACH_PASSWORD env var — must be a bcrypt hash.
 *           Generate: node -e "require('bcryptjs').hash('pw',12).then(console.log)"
 */

import crypto from "crypto";
import bcrypt  from "bcryptjs";
import { signSession, verifySession } from "./security";
import prisma from "./prisma";

const COACH_COOKIE = "__Host-ak_coach";
export const COACH_SESSION_TTL_S = 4 * 60 * 60; // 4 hours

// ─── Cookie helpers (reuse security.ts signing so SESSION_SECRET is shared) ───

export function getCoachSessionToken(req: any): string {
  return req.cookies?.[COACH_COOKIE] ?? "";
}

export function verifyCoachSession(cookieValue: string): string | null {
  return verifySession(cookieValue);
}

export function buildCoachSessionCookie(payload: string): string {
  const value = signSession(payload);
  return [
    `${COACH_COOKIE}=${value}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${COACH_SESSION_TTL_S}`,
  ].join("; ");
}

export function clearCoachSessionCookie(): string {
  return `${COACH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

// ─── Session version ──────────────────────────────────────────────────────────

const SESSION_VERSION_KEY = "coach_session_version";

/**
 * Returns the current coach session version from the DB (default 0).
 * Embed in the session payload at login; verify on every authenticated request.
 * Incrementing it (on password change) immediately invalidates all issued sessions.
 */
export async function getCoachSessionVersion(): Promise<number> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: SESSION_VERSION_KEY } });
    return setting ? parseInt(setting.value, 10) || 0 : 0;
  } catch {
    // If the DB is unavailable we fail open here — requireCoachAuth will catch
    // the same error and reject the request.
    return 0;
  }
}

/**
 * Increments the session version, invalidating all currently issued coach sessions.
 * Call this on password change.
 */
export async function incrementCoachSessionVersion(): Promise<void> {
  const current = await getCoachSessionVersion();
  await prisma.setting.upsert({
    where:  { key: SESSION_VERSION_KEY },
    update: { value: String(current + 1) },
    create: { key: SESSION_VERSION_KEY, value: String(current + 1) },
  });
}

// ─── Password ─────────────────────────────────────────────────────────────────

/**
 * Verifies the coach password.
 * Priority: DB Setting("coach_password_hash") → COACH_PASSWORD env var.
 * This lets the coach change their own password without the site owner knowing.
 */
export async function verifyCoachPassword(plaintext: string): Promise<boolean> {
  // 1. Try DB-stored hash first (set by the coach via self-service)
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "coach_password_hash" } });
    if (setting?.value && (setting.value.startsWith("$2b$") || setting.value.startsWith("$2a$"))) {
      return bcrypt.compare(plaintext, setting.value);
    }
  } catch { /* fall through to env var */ }

  // 2. Fall back to env var (initial setup / bootstrap)
  const hash = process.env.COACH_PASSWORD;
  if (!hash) {
    console.error("[coachAuth] COACH_PASSWORD is not set and no DB password found");
    return false;
  }
  if (!hash.startsWith("$2b$") && !hash.startsWith("$2a$")) {
    console.error("[coachAuth] COACH_PASSWORD is not a bcrypt hash");
    return false;
  }
  return bcrypt.compare(plaintext, hash);
}

/**
 * Stores a new bcrypt-hashed password in the DB.
 * Called by the coach self-service endpoint only.
 */
export async function setCoachPasswordHash(hash: string): Promise<void> {
  await prisma.setting.upsert({
    where:  { key: "coach_password_hash" },
    update: { value: hash },
    create: { key: "coach_password_hash", value: hash },
  });
}

// ─── Token (URL slug) check ───────────────────────────────────────────────────

/**
 * Validates the URL token against the COACH_TOKEN env var using a
 * timing-safe comparison so the secret length is not leaked.
 */
export function isValidCoachToken(token: string): boolean {
  const expected = process.env.COACH_TOKEN;
  if (!expected || !token) return false;
  try {
    const a = Buffer.from(token,    "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch { return false; }
}
