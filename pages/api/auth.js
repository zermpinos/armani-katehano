/**
 * pages/api/auth.js
 *
 * GET    /api/auth  → 200 if session cookie is valid, 401 otherwise
 * POST   /api/auth  → validate password, set session cookie on success
 * DELETE /api/auth  → clear session cookie (logout)
 *
 * S-03: Now uses verifyPassword() (bcrypt) from lib/security.js.
 *       Previously used safePasswordCompare() (SHA-256) which is not a KDF.
 *
 * ADMIN_PASSWORD must be stored as a bcrypt hash in Vercel env vars.
 * Generate it once:
 *   node -e "require('bcryptjs').hash('YOUR_PASSWORD',12).then(console.log)"
 */

import { isLockedOut, recordAttempt, clearAttempts } from "../../../lib/loginAttempts.js";
import {
  verifySession,
  verifyPassword,
  buildSessionCookie,
  clearSessionCookie,
  securityHeaders,
  auditLog,
  checkCsrf,
} from "../../../lib/security.js";

export default async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  // ── GET: check existing session ───────────────────────────────────────────
  if (req.method === "GET") {
    const cookie  = req.cookies?.["__Host-ak_session"] ?? "";
    const payload = verifySession(cookie);

    if (payload) {
      return res.status(200).json({ ok: true });
    }
    return res.status(401).json({ error: "Not authenticated" });
  }

  // ── DELETE: logout ────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearSessionCookie());
    auditLog("logout", { ip });
    return res.status(200).json({ ok: true });
  }

  // ── POST: login ───────────────────────────────────────────────────────────
  if (req.method === "POST") {
    // CSRF check — Origin/Referer must match the app host
    if (!checkCsrf(req)) {
      auditLog("csrf_rejected", { ip });
      return res.status(403).json({ error: "Forbidden" });
    }

    const { password, slug } = req.body ?? {};

    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Password is required" });
    }

    // ── Brute-force lockout ───────────────────────────────────────────────
    const locked = await isLockedOut(ip);
    if (locked) {
      auditLog("login_locked", { ip });
      return res.status(429).json({
        error:      "Too many failed attempts. Try again later.",
        retryAfter: 900, // seconds
      });
    }

    // ── Password check (S-03: bcrypt via verifyPassword) ─────────────────
    const valid = await verifyPassword(password);

    if (!valid) {
      await recordAttempt(ip);
      auditLog("login_failed", { ip });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ── Success: clear lockout counter, set session cookie ────────────────
    await clearAttempts(ip);

    const payload = JSON.stringify({ ip, ts: Date.now() });
    res.setHeader("Set-Cookie", buildSessionCookie(payload));

    auditLog("login_success", { ip, slug });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}