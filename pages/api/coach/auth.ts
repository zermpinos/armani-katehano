/**
 * pages/api/coach/auth.ts
 *
 * GET    /api/coach/auth  → 200 if coach session valid, 401 otherwise
 * POST   /api/coach/auth  → validate coach password, set coach session cookie
 * DELETE /api/coach/auth  → clear coach session cookie (logout)
 *
 * Uses a separate cookie (__Host-ak_coach) and COACH_PASSWORD env var.
 * Brute-force lockout reuses the shared LoginAttempt table (5 attempts → 15 min).
 */

import { isLockedOut, recordAttempt, clearAttempts } from "../../../lib/loginAttempts";
import { securityHeaders, auditLog, csrfCheck, getClientIp } from "../../../lib/security";
import {
  getCoachSessionToken,
  verifyCoachSession,
  verifyCoachPassword,
  buildCoachSessionCookie,
  clearCoachSessionCookie,
  COACH_SESSION_TTL_S,
} from "../../../lib/coachAuth";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const ip = getClientIp(req);

  // ── GET: check session ────────────────────────────────────────────────────
  if (req.method === "GET") {
    const token   = getCoachSessionToken(req);
    const payload = verifyCoachSession(token);
    if (!payload) return res.status(401).json({ error: "Not authenticated" });

    let parsed: any;
    try { parsed = JSON.parse(payload); } catch {
      return res.status(401).json({ error: "Invalid session" });
    }
    if (parsed?.role !== "coach") return res.status(401).json({ error: "Unauthorized" });
    if (!parsed?.ts || Date.now() - parsed.ts > COACH_SESSION_TTL_S * 1000) {
      return res.status(401).json({ error: "Session expired" });
    }
    return res.status(200).json({ ok: true });
  }

  // ── DELETE: logout ────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearCoachSessionCookie());
    auditLog("coach_logout", { ip });
    return res.status(200).json({ ok: true });
  }

  // ── POST: login ───────────────────────────────────────────────────────────
  if (req.method === "POST") {
    if (!csrfCheck(req, { strict: true })) {
      auditLog("coach_csrf_rejected", { ip });
      return res.status(403).json({ error: "Forbidden" });
    }

    const { password } = req.body ?? {};
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Password is required" });
    }

    const locked = await isLockedOut(ip);
    if (locked) {
      auditLog("coach_login_locked", { ip });
      return res.status(429).json({ error: "Too many failed attempts. Try again later.", retryAfter: 900 });
    }

    const valid = await verifyCoachPassword(password);
    if (!valid) {
      await recordAttempt(ip);
      auditLog("coach_login_failed", { ip });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await clearAttempts(ip);
    const payload = JSON.stringify({ ts: Date.now(), role: "coach" });
    res.setHeader("Set-Cookie", buildCoachSessionCookie(payload));
    auditLog("coach_login_success", { ip });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
