/**
 * lib/security.js
 *
 * HMAC session signing, password verification, CSRF check, security headers.
 *
 * S-03: verifyPassword() uses bcrypt (via bcryptjs) instead of SHA-256.
 *       ADMIN_PASSWORD must now be stored as a bcrypt hash in Vercel env vars.
 *       Generate once: node -e "require('bcryptjs').hash('YOUR_PW',12).then(console.log)"
 *
 * NOTE on naming: requireAuth.js imports { verifyPayload, getSessionToken }.
 *   These are preserved as aliases so requireAuth.js needs no changes.
 */

import crypto from "crypto";
import bcrypt  from "bcryptjs";

// ─── Constants ────────────────────────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME    = "__Host-ak_session";
const SESSION_TTL_S  = 8 * 60 * 60; // 8 hours

// ─── Session cookie helpers ───────────────────────────────────────────────────

/**
 * Signs a payload string with HMAC-SHA256.
 * Returns a cookie-safe value: base64url(payload).base64url(sig)
 */
export function signSession(payload) {
  if (!SESSION_SECRET) throw new Error("SESSION_SECRET is not set");
  const data = Buffer.from(payload).toString("base64url");
  const sig  = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Verifies and decodes a signed session cookie value.
 * Returns the original payload string, or null if invalid.
 */
export function verifySession(cookieValue) {
  if (!SESSION_SECRET || !cookieValue) return null;
  const [data, sig] = cookieValue.split(".");
  if (!data || !sig) return null;

  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(data)
    .digest("base64url");

  try {
    const a = Buffer.from(sig,      "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return Buffer.from(data, "base64url").toString("utf8");
}

/**
 * Alias: requireAuth.js calls verifyPayload() to check a session cookie value.
 * Delegates to verifySession — same logic, preserved name for compatibility.
 */
export const verifyPayload = verifySession;

/**
 * Extracts the raw session cookie string from a Next.js request object.
 * requireAuth.js calls getSessionToken(req) before passing to verifyPayload().
 */
export function getSessionToken(req) {
  return req.cookies?.[COOKIE_NAME] ?? "";
}

/**
 * Builds the Set-Cookie header string for a new session.
 */
export function buildSessionCookie(payload) {
  const value = signSession(payload);
  return [
    `${COOKIE_NAME}=${value}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${SESSION_TTL_S}`,
  ].join("; ");
}

/**
 * Builds a Set-Cookie header that clears the session.
 */
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

// ─── Password verification (S-03) ────────────────────────────────────────────

export async function verifyPassword(plaintext) {
  const hash = process.env.ADMIN_PASSWORD;
  if (!hash) {
    console.error("[security] ADMIN_PASSWORD is not set");
    return false;
  }
  if (!hash.startsWith("$2b$") && !hash.startsWith("$2a$")) {
    console.error(
      "[security] ADMIN_PASSWORD is not a bcrypt hash. " +
      "Run: node -e \"require('bcryptjs').hash('YOUR_PASSWORD',12).then(console.log)\" " +
      "and store the $2b$... output in Vercel env vars."
    );
    return false;
  }
  return bcrypt.compare(plaintext, hash);
}

/**
 * @deprecated Use verifyPassword() — kept so any legacy callers don't break.
 */
export const safePasswordCompare = verifyPassword;

// ─── CSRF check ───────────────────────────────────────────────────────────────

/**
 * Returns true if the request's Origin or Referer matches the app's own host.
 */
export function checkCsrf(req) {
  const origin  = req.headers["origin"]  ?? "";
  const referer = req.headers["referer"] ?? "";
  const host    = req.headers["host"]    ?? "";
  const check = (url) => { try { return new URL(url).host === host; } catch { return false; } };
  return check(origin) || check(referer);
}

// ─── Security headers ─────────────────────────────────────────────────────────

/**
 * Returns security headers appropriate for JSON API responses.
 * S-07: Only apply to API routes — not page responses.
 */
export function securityHeaders() {
  return {
    "Content-Security-Policy":   "default-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options":    "nosniff",
    "X-Frame-Options":           "DENY",
    "Referrer-Policy":           "no-referrer",
    "Permissions-Policy":        "camera=(), microphone=(), geolocation=()",
  };
}


// Lockout TTL & Max login attempts

export const LOCKOUT_TTL_S = 60 * 15; // 15 minutes
export const MAX_LOGIN_ATTEMPTS = 5;

// ─── Audit log ────────────────────────────────────────────────────────────────

/** Structured audit log → Vercel log drain. */
export function auditLog(event, data = {}) {
  console.log(JSON.stringify({
    type:      "[AUDIT]",
    event,
    timestamp: new Date().toISOString(),
    ...data,
  }));
}
