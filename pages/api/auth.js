/**
 * api/auth.js
 * POST /api/auth   -> login
 * DELETE /api/auth -> logout
 *
 * Brute-force protection: 5 failed attempts in 15 minutes -> lockout (Neon).
 */

import {
  isLockedOut,
  recordAttempt,
  clearAttempts,
  getLockoutTTL,
} from "../../lib/loginAttempts.js";

import {
  safePasswordCompare,
  buildSessionCookie,
  clearSessionCookie,
  getSessionToken,
  verifyPayload,
  securityHeaders,
  auditLog,
} from "../../lib/security.js";

const REQUIRED_ENV = ["ADMIN_PASSWORD", "SESSION_SECRET", "ADMIN_SLUG"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

export default async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  // ── Session check ────────────────────────────────────────────────
  if (req.method === "GET") {
    const token = getSessionToken(req.headers.cookie ?? "");
    const valid = token ? verifyPayload(token, process.env.SESSION_SECRET) !== null : false;
    return res.status(valid ? 200 : 401).json({ ok: valid });
  }

  // ── Logout ───────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearSessionCookie());
    auditLog("logout", { ip });
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Lockout check ────────────────────────────────────────────────────────────
  if (await isLockedOut(ip)) {
    const retryAfter = await getLockoutTTL(ip);
    auditLog("login_blocked_lockout", { ip });
    return res.status(429).json({
      error: "Too many attempts. Try again later.",
      retryAfter,
    });
  }

  const { password, slug } = req.body ?? {};

  if (typeof password !== "string" || typeof slug !== "string") {
    return res.status(400).json({ error: "Invalid request" });
  }

  const passwordOk = safePasswordCompare(password, process.env.ADMIN_PASSWORD);
  const slugOk     = safePasswordCompare(slug,     process.env.ADMIN_SLUG);

  if (!passwordOk || !slugOk) {
    await recordAttempt(ip);
    auditLog("login_failed", { ip });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  await clearAttempts(ip);
  res.setHeader("Set-Cookie", buildSessionCookie(process.env.SESSION_SECRET));
  auditLog("login_success", { ip });
  return res.status(200).json({ ok: true });
}
