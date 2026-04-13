/**
 * lib/requireCoachAuth.ts
 * Middleware wrapper for coach-portal API routes.
 * Usage: export default requireCoachAuth(handler)
 *
 * Checks:
 *   1. CSRF origin header
 *   2. Coach session cookie presence and HMAC validity
 *   3. role === "coach" in the payload
 *   4. Session not older than COACH_SESSION_TTL_S
 */

import { securityHeaders, auditLog, csrfCheck, getClientIp } from "./security";
import {
  getCoachSessionToken,
  verifyCoachSession,
  getCoachSessionVersion,
  COACH_SESSION_TTL_S,
} from "./coachAuth";

export function requireCoachAuth(handler: (req: any, res: any) => any) {
  return async function (req: any, res: any) {
    Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

    const ip = getClientIp(req);

    // ── CSRF ──────────────────────────────────────────────────────────────────
    if (!csrfCheck(req)) {
      auditLog("coach_csrf_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }

    // ── Session ───────────────────────────────────────────────────────────────
    const token   = getCoachSessionToken(req);
    const payload = verifyCoachSession(token);

    if (!payload) {
      auditLog("coach_unauthorized", { ip, path: req.url, method: req.method });
      return res.status(401).json({ error: "Unauthorized" });
    }

    let parsed: any;
    try { parsed = JSON.parse(payload); } catch {
      auditLog("coach_invalid_session_payload", { ip });
      return res.status(401).json({ error: "Invalid session" });
    }

    if (parsed?.role !== "coach") {
      auditLog("coach_wrong_role", { ip, role: parsed?.role });
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!parsed?.ts || Date.now() - parsed.ts > COACH_SESSION_TTL_S * 1000) {
      auditLog("coach_expired_session", { ip, ts: parsed?.ts });
      return res.status(401).json({ error: "Session expired" });
    }

    // Session version check: invalidates all sessions issued before the last
    // password change. parsed.v defaults to 0 for sessions issued pre-feature.
    const currentVersion = await getCoachSessionVersion();
    if ((parsed.v ?? 0) !== currentVersion) {
      auditLog("coach_session_revoked", { ip, sessionV: parsed.v, currentV: currentVersion });
      return res.status(401).json({ error: "Session revoked. Please log in again." });
    }

    return handler(req, res);
  };
}
