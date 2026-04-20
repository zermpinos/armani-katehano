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
import { TOTP, Secret } from "otpauth";
import * as Sentry from "@sentry/nextjs";

// ─── Constants ────────────────────────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME    = "__Host-ak_session";
export const SESSION_TTL_S  = 4 * 60 * 60; // 4 hours

// ─── Session cookie helpers ───────────────────────────────────────────────────

/**
 * Signs a payload string with HMAC-SHA256.
 * Returns a cookie-safe value: base64url(payload).base64url(sig)
 */
export function signSession(payload: string) {
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
export function verifySession(cookieValue: string | null | undefined) {
  if (!SESSION_SECRET || !cookieValue) return null;

  // Use lastIndexOf so dots inside the base64url payload don't break the split
  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot === -1) return null;

  const data = cookieValue.slice(0, lastDot);
  const sig  = cookieValue.slice(lastDot + 1);
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
export function getSessionToken(req: any) {
  // eslint-disable-next-line security/detect-object-injection
  return req.cookies?.[COOKIE_NAME] ?? "";
}

/**
 * Builds the Set-Cookie header string for a new session.
 */
export function buildSessionCookie(payload: string) {
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

export async function verifyPassword(plaintext: string) {
  const hash = process.env.ADMIN_PASSWORD;
  if (!hash) {
    console.error("[security] ADMIN_PASSWORD is not set");
    return false;
  }
  if (!hash.startsWith("$2b$") && !hash.startsWith("$2a$")) {
    console.error("[security] ADMIN_PASSWORD is not a bcrypt hash.");
    return false;
  }
  return bcrypt.compare(plaintext, hash);
}

/**
 * Multi-user credential check.
 * Reads ADMIN_USERS (JSON array of { username, passwordHash }) when set.
 * Falls back to ADMIN_PASSWORD with username "admin" for single-user deployments.
 */
export async function verifyCredentials(username: string, plaintext: string): Promise<boolean> {
  const usersJson = process.env.ADMIN_USERS;
  if (usersJson) {
    let users: { username: string; passwordHash: string }[];
    try {
      users = JSON.parse(usersJson);
    } catch {
      console.error("[security] ADMIN_USERS is not valid JSON");
      return false;
    }
    const user = users.find(u => u.username === username);
    if (!user) return false;
    if (!user.passwordHash.startsWith("$2b$") && !user.passwordHash.startsWith("$2a$")) {
      console.error(`[security] passwordHash for "${username}" is not a bcrypt hash`);
      return false;
    }
    return bcrypt.compare(plaintext, user.passwordHash);
  }
  // Single-user fallback: ADMIN_PASSWORD, username must be "admin"
  if (username !== "admin") return false;
  return verifyPassword(plaintext);
}

/** @deprecated Use verifyPassword() — kept so any legacy callers don't break. */
export const safePasswordCompare = verifyPassword;

// ─── Admin user lookup ────────────────────────────────────────────────────────

export type AdminUser = { username: string; passwordHash: string; totpSecret?: string };

export function getAdminUser(username: string): AdminUser | null {
  const usersJson = process.env.ADMIN_USERS;
  if (usersJson) {
    try {
      const users: AdminUser[] = JSON.parse(usersJson);
      return users.find(u => u.username === username) ?? null;
    } catch { return null; }
  }
  // Single-user fallback
  if (username !== "admin") return null;
  const hash = process.env.ADMIN_PASSWORD;
  return hash ? { username: "admin", passwordHash: hash } : null;
}

// ─── TOTP verification ────────────────────────────────────────────────────────

export function verifyTotp(secret: string, token: string): boolean {
  try {
    const totp = new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 });
    return totp.validate({ token, window: 1 }) !== null;
  } catch { return false; }
}

/**
 * Generates a new TOTP secret and the otpauth:// URI to scan into an authenticator app.
 * Run once per user: node -e "require('./lib/security').generateTotpSetup('username')"
 */
export function generateTotpSetup(username: string): { secret: string; uri: string } {
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({ label: `AKAdmin:${username}`, issuer: "AKAdmin", secret, digits: 6, period: 30 });
  return { secret: secret.base32, uri: totp.toString() };
}

// ─── CSRF check ───────────────────────────────────────────────────────────────

const CSRF_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

/**
 * Returns true if the request passes the CSRF origin check.
 *
 * GET/HEAD/OPTIONS are exempt — they must be read-only.
 * For mutating methods, checks Origin then Referer against the Host header.
 *
 * strict=true  — rejects requests with no Origin and no Referer (login endpoint).
 * strict=false — allows requests with no Origin and no Referer (e.g. server-to-server). Default.
 *
 * SameSite=Strict on the session cookie provides the primary CSRF defence;
 * this is a defence-in-depth layer.
 */
export function csrfCheck(req: any, { strict = false } = {}) {
  if (!CSRF_METHODS.has(req.method)) return true;

  const host    = req.headers["host"]    ?? "";
  const origin  = req.headers["origin"]  ?? "";
  const referer = req.headers["referer"] ?? "";

  if (origin) {
    try { return new URL(origin).host === host; } catch { return false; }
  }
  if (referer) {
    try { return new URL(referer).host === host; } catch { return false; }
  }
  // No Origin and no Referer
  return !strict;
}

/**
 * @deprecated Use csrfCheck(). Kept for any remaining callers.
 */
export const checkCsrf = (req: any) => csrfCheck(req, { strict: true });

// ─── Double-submit CSRF token ─────────────────────────────────────────────────

const CSRF_COOKIE_NAME = "__Host-ak_csrf";

/** Generates a 32-byte random hex token. */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Non-HttpOnly cookie so the browser's JS can read and echo it back. */
export function buildCsrfCookie(token: string): string {
  return [`${CSRF_COOKIE_NAME}=${token}`, "Secure", "SameSite=Strict", "Path=/"].join("; ");
}

export function clearCsrfCookie(): string {
  return `${CSRF_COOKIE_NAME}=; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/**
 * Double-submit CSRF token check (defense-in-depth).
 * When the CSRF cookie is present the X-CSRF-Token header must match it.
 * If the cookie is absent (pre-login or pre-rollout session) the check is skipped —
 * the Origin/Referer check in csrfCheck() is still enforced.
 */
export function csrfTokenCheck(req: any): boolean {
  if (!CSRF_METHODS.has(req.method)) return true;
  // eslint-disable-next-line security/detect-object-injection
  const cookie = req.cookies?.[CSRF_COOKIE_NAME];
  if (!cookie) return true;
  const header = req.headers["x-csrf-token"];
  if (!header || typeof header !== "string") return false;
  try {
    const a = Buffer.from(cookie, "utf8");
    const b = Buffer.from(header, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch { return false; }
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
    "Cache-Control":             "no-store",
  };
}


// Lockout TTL & Max login attempts

export const LOCKOUT_TTL_S = 60 * 15; // 15 minutes
export const MAX_LOGIN_ATTEMPTS = 5;
export const CAPTCHA_THRESHOLD = 3; // require CAPTCHA after this many IP failures

// ─── Client IP extraction ─────────────────────────────────────────────────────

/**
 * Returns the real client IP from a Next.js request.
 *
 * Vercel sets x-real-ip to the connecting client IP before passing the
 * request to the serverless function — this value cannot be spoofed by
 * the client. x-forwarded-for is only used as a fallback because its
 * first entry CAN be injected by an attacker who sends the header before
 * Vercel appends the real IP at the end of the chain.
 */
export function getClientIp(req: any): string {
  return (
    (req.headers["x-real-ip"] as string | undefined)?.trim() ||
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",").pop()?.trim() ||
    "unknown"
  );
}

// ─── Audit log ────────────────────────────────────────────────────────────────

// ─── CAPTCHA verification ─────────────────────────────────────────────────────

export async function verifyCaptcha(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("[captcha] TURNSTILE_SECRET_KEY not set — skipping verification");
    return true;
  }
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const data = await res.json();
  return data.success === true;
}

// Events that indicate an active attack or lockout — forwarded to Sentry so
// alert rules can page on them without waiting for manual log inspection.
const SECURITY_ALERT_EVENTS = new Set([
  "login_account_locked",
  "login_locked",
  "login_totp_failed",
  "csrf_blocked",
  "csrf_token_blocked",
  "coach_session_revoked",
  "coach_login_account_locked",
  "coach_csrf_blocked",
  "coach_csrf_token_blocked",
]);

/** Structured audit log → Vercel log drain. Security-critical events also go to Sentry. */
export function auditLog(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    type:      "[AUDIT]",
    event,
    timestamp: new Date().toISOString(),
    ...data,
  }));
  if (SECURITY_ALERT_EVENTS.has(event)) {
    Sentry.captureMessage(`[AUDIT] ${event}`, {
      level: "warning",
      tags:  { audit_event: event },
      extra: data,
    });
  }
}
