/**
 * lib/security.js
 * Core security primitives — all crypto is native Node.js, no third-party libs.
 */

import crypto from "crypto";

// ─── Constants ────────────────────────────────────────────────────────────────
export const COOKIE_NAME      = "__Host-ak_session";   // __Host- prefix enforces Secure + path=/
export const SESSION_TTL_S    = 60 * 60 * 8;           // 8 hours
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_TTL_S    = 60 * 15;               // 15 minutes
export const MAX_PDF_BYTES    = 5 * 1024 * 1024;       // 5 MB hard cap
export const RATE_LIMIT_RPM   = 10;                    // max 10 convert requests / minute / IP

// PDF magic bytes: %PDF
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);

// ─── HMAC session cookie ──────────────────────────────────────────────────────

/**
 * Signs a payload with HMAC-SHA256.
 * Format: base64url(payload).base64url(signature)
 */
export function signPayload(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig  = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Verifies and decodes a signed payload.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyPayload(token, secret) {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64url");

    // Constant-time comparison (OWASP A02)
    const sigBuf = Buffer.from(sig,      "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = JSON.parse(Buffer.from(data, "base64url").toString());

    // Check expiry
    if (!payload.exp || Date.now() / 1000 > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Builds a Set-Cookie header value with all security flags.
 */
export function buildSessionCookie(secret) {
  const payload = {
    sub: "admin",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S,
  };
  const token = signPayload(payload, secret);
  const expires = new Date(Date.now() + SESSION_TTL_S * 1000).toUTCString();

  return [
    `${COOKIE_NAME}=${token}`,
    `Expires=${expires}`,
    `Path=/`,
    `HttpOnly`,          // not accessible via JS (XSS mitigation)
    `Secure`,            // HTTPS only
    `SameSite=Strict`,   // CSRF mitigation
  ].join("; ");
}

/**
 * Clears the session cookie.
 */
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

/**
 * Parses a cookie string and returns the session token if present.
 */
export function getSessionToken(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

// ─── Password verification ────────────────────────────────────────────────────

/**
 * Constant-time password comparison (OWASP A07).
 * Hashes both strings with SHA-256 before comparing so lengths
 * don't leak timing information.
 */
export function safePasswordCompare(input, stored) {
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(stored).digest();
  return crypto.timingSafeEqual(a, b);
}

// ─── PDF magic byte validation ────────────────────────────────────────────────

/**
 * Verifies the first 4 bytes match %PDF.
 * Rejects files that are merely renamed with a .pdf extension.
 */
export function isValidPDF(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  return PDF_MAGIC.equals(buffer.slice(0, 4));
}

// ─── Security headers ─────────────────────────────────────────────────────────

/**
 * Returns a complete set of OWASP-recommended response headers.
 * Applied to every API response.
 */
export function securityHeaders() {
  return {
    "Content-Security-Policy":        "default-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options":         "nosniff",
    "X-Frame-Options":                "DENY",
    "Referrer-Policy":                "no-referrer",
    "Permissions-Policy":             "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security":      "max-age=63072000; includeSubDomains; preload",
    "Cache-Control":                  "no-store",
    "X-XSS-Protection":               "0",   // disable legacy XSS auditor (can be abused)
  };
}

// ─── Logging ──────────────────────────────────────────────────────────────────

/**
 * Structured audit log — goes to Vercel's log stream.
 * Never logs passwords or tokens.
 */
export function auditLog(event, data = {}) {
  const entry = {
    ts:    new Date().toISOString(),
    event,
    ...data,
  };
  // Redact any accidental sensitive fields
  delete entry.password;
  delete entry.token;
  console.log("[AUDIT]", JSON.stringify(entry));
}
