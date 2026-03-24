/**
 * lib/security.js
 *
 * HMAC session signing, password comparison, CSRF check, security headers.
 *
 * S-03: ADMIN_PASSWORD is now compared using bcrypt instead of SHA-256.
 * SHA-256 is a fast hash — not a key-derivation function — so it provides
 * no meaningful protection against brute-force if the hash is ever exposed.
 * bcrypt with cost factor 12 makes each comparison ~300ms, which is
 * negligible for a single-admin app but makes brute-force infeasible.
 *
 * Migration: ADMIN_PASSWORD in Vercel env vars must now be stored as a
 * bcrypt hash, not plaintext. Generate it once with:
 *
 *   node -e "const b=require('bcryptjs'); b.hash('YOUR_PASSWORD',12).then(console.log)"
 *
 * Then set the output (starting with $2b$) as ADMIN_PASSWORD in Vercel.
 *
 * Dependency: bcryptjs (pure-JS, no native bindings — works in Vercel Edge)
 *   npm install bcryptjs
 */

import crypto  from "crypto";
import bcrypt  from "bcryptjs";

// ─── Session cookie ───────────────────────────────────────────────────────────

const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME    = "__Host-ak_session";
const SESSION_TTL_S  = 8 * 60 * 60; // 8 hours

/**
 * Signs a payload string with HMAC-SHA256 and returns a cookie value.
 * Format: base64(payload).base64(signature)
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
 * Verifies and decodes a session cookie value.
 * Returns the original payload string, or null if invalid/tampered.
 */
export function verifySession(cookieValue) {
  if (!SESSION_SECRET || !cookieValue) return null;
  const [data, sig] = cookieValue.split(".");
  if (!data || !sig) return null;

  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(data)
    .digest("base64url");

  // Timing-safe comparison to prevent signature oracle attacks
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
 * Builds the Set-Cookie header string for a new session.
 */
export function buildSessionCookie(payload) {
  const value = signSession(payload);
  return [
    `${COOKIE_NAME}=${value}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Path=/`,
    `Max-Age=${SESSION_TTL_S}`,
  ].join("; ");
}

/**
 * Builds a Set-Cookie header that clears the session.
 */
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

// ─── Password comparison ──────────────────────────────────────────────────────

/**
 * S-03: Compares a plaintext password against the bcrypt hash stored in
 * ADMIN_PASSWORD environment variable.
 *
 * Previously this used SHA-256 (safePasswordCompare), which is a fast hash
 * and not suitable for password storage. bcrypt with cost 12 is the
 * industry standard for single-admin apps.
 *
 * Returns: Promise<boolean>
 */
export async function verifyPassword(plaintext) {
  const hash = process.env.ADMIN_PASSWORD;
  if (!hash) {
    console.error("[security] ADMIN_PASSWORD is not set");
    return false;
  }

  // Detect legacy plaintext storage and refuse with a clear error.
  // A bcrypt hash always starts with $2b$ or $2a$.
  if (!hash.startsWith("$2b$") && !hash.startsWith("$2a$")) {
    console.error(
      "[security] ADMIN_PASSWORD does not appear to be a bcrypt hash. " +
      "Run: node -e \"require('bcryptjs').hash('YOUR_PASSWORD',12).then(console.log)\" " +
      "and store the result in Vercel env vars."
    );
    return false;
  }

  return bcrypt.compare(plaintext, hash);
}

/**
 * Legacy export — kept so any remaining callers don't break during migration.
 * @deprecated Use verifyPassword() instead.
 */
export async function safePasswordCompare(input) {
  return verifyPassword(input);
}

// ─── CSRF ─────────────────────────────────────────────────────────────────────

/**
 * Returns true if the request passes the CSRF origin check.
 * Verifies that Origin or Referer matches the app's own host.
 */
export function checkCsrf(req) {
  const origin  = req.headers["origin"]  ?? "";
  const referer = req.headers["referer"] ?? "";
  const host    = req.headers["host"]    ?? "";

  const check = (url) => {
    try {
      return new URL(url).host === host;
    } catch {
      return false;
    }
  };

  return check(origin) || check(referer);
}

// ─── Security headers ─────────────────────────────────────────────────────────

/**
 * Returns security headers for API responses.
 * Intentionally strict (default-src 'none') since these are JSON endpoints.
 * Do NOT apply these to page responses — see S-07 in the audit.
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

// ─── Audit log ────────────────────────────────────────────────────────────────

/**
 * Writes a structured audit log entry to stdout (→ Vercel log drain).
 * Format is intentionally JSON-parseable for log management tools.
 */
export function auditLog(event, data = {}) {
  console.log(JSON.stringify({
    type:      "[AUDIT]",
    event,
    timestamp: new Date().toISOString(),
    ...data,
  }));
}