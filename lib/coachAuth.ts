/**
 * lib/coachAuth.ts
 *
 * Auth helpers for the coach portal -- fully separate from the admin session.
 *
 * Cookie : __Host-ak_coach  (HttpOnly, Secure, SameSite=Strict, Path=/)
 * Secret : same SESSION_SECRET used for HMAC signing (key reuse is fine;
 *          the cookie name and role field prevent cross-session confusion)
 * Password: COACH_PASSWORD env var -- must be a bcrypt hash.
 *           Generate: node -e "require('bcryptjs').hash('pw',12).then(console.log)"
 */

import crypto from "crypto";
import bcrypt  from "bcryptjs";
import { signSession, verifySession } from "./security";

const COACH_COOKIE = "__Host-ak_coach";
export const COACH_SESSION_TTL_S = 8 * 60 * 60; // 8 hours

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

// ─── Password ─────────────────────────────────────────────────────────────────

export async function verifyCoachPassword(plaintext: string): Promise<boolean> {
  const hash = process.env.COACH_PASSWORD;
  if (!hash) {
    console.error("[coachAuth] COACH_PASSWORD is not set");
    return false;
  }
  if (!hash.startsWith("$2b$") && !hash.startsWith("$2a$")) {
    console.error("[coachAuth] COACH_PASSWORD is not a bcrypt hash");
    return false;
  }
  return bcrypt.compare(plaintext, hash);
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
