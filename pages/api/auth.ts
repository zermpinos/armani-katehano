/**
 * pages/api/auth.js
 *
 * GET    /api/auth  -> 200 if session is valid, 401 otherwise
 * POST   /api/auth  -> validate password, set session cookie on success
 * DELETE /api/auth  -> clear session cookie (logout)
 *
 * S-03: Now uses verifyPassword() (bcrypt) from lib/security.
 *       ADMIN_PASSWORD must be stored as a bcrypt hash in Vercel env vars.
 *       Generate: node -e "require('bcryptjs').hash('YOUR_PW',12).then(console.log)"
 */

import { isLockedOut, recordAttempt, clearAttempts } from "../../lib/loginAttempts";
import {getSessionToken, verifyPayload, verifyPassword,buildSessionCookie,clearSessionCookie, securityHeaders,auditLog, csrfCheck, getClientIp,} from "../../lib/security";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const ip = getClientIp(req);

  // ── GET: check existing session ───────────────────────────────────────────
  if (req.method === "GET") {
    const token   = getSessionToken(req);
    const payload = verifyPayload(token);
    if (payload) return res.status(200).json({ ok: true });
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
    if (!csrfCheck(req, { strict: true })) {
      auditLog("csrf_rejected", { ip });
      return res.status(403).json({ error: "Forbidden" });
    }

    const { password, slug } = req.body ?? {};
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Password is required" });
    }

    // Brute-force lockout -- per-IP
    const locked = await isLockedOut(ip);
    if (locked) {
      auditLog("login_locked", { ip });
      return res.status(429).json({ error: "Too many failed attempts. Try again later.", retryAfter: 900 });
    }

    // Brute-force lockout -- per-account (H-2): 25 attempts across any IP, 1-hour window
    const ACCOUNT_KEY = "account_admin";
    const accountLocked = await isLockedOut(ACCOUNT_KEY, 25, 3600);
    if (accountLocked) {
      auditLog("login_account_locked", { ip });
      return res.status(429).json({ error: "Too many attempts across all clients. Try again in an hour.", retryAfter: 3600 });
    }

    // S-03: bcrypt comparison via verifyPassword()
    const valid = await verifyPassword(password);
    if (!valid) {
      await Promise.all([recordAttempt(ip), recordAttempt(ACCOUNT_KEY)]);
      auditLog("login_failed", { ip });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await Promise.all([clearAttempts(ip), clearAttempts(ACCOUNT_KEY)]);
    const payload = JSON.stringify({ ts: Date.now(), role: "admin" });
    res.setHeader("Set-Cookie", buildSessionCookie(payload));
    auditLog("login_success", { ip, slug });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}