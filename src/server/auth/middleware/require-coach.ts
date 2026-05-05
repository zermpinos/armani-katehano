import "@/server/_internal/node-only";
import { securityHeaders }                                                            from "@/server/security/edge/headers";
import { auditLog }                                                                   from "@/server/security/node/audit-log";
import { csrfCheck, csrfTokenCheck }                                                  from "@/server/auth/csrf";
import { getClientIp }                                                                from "@/server/security/node/client-ip";
import { getCoachSessionToken, verifyCoachSession, getCoachSessionVersion, COACH_SESSION_TTL_S } from "@/server/auth/coach";

export function requireCoachAuth(handler: (req: any, res: any) => any) {
  return async function (req: any, res: any) {
    Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

    const ip = getClientIp(req);

    if (!csrfCheck(req, { strict: true })) {
      auditLog("coach_csrf_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!csrfTokenCheck(req)) {
      auditLog("coach_csrf_token_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }

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

    let currentVersion: number;
    try {
      currentVersion = await getCoachSessionVersion();
    } catch {
      auditLog("coach_session_version_db_error", { ip, path: req.url });
      return res.status(503).json({ error: "Service unavailable" });
    }
    if ((parsed.v ?? 0) !== currentVersion) {
      auditLog("coach_session_revoked", { ip, sessionV: parsed.v, currentV: currentVersion });
      return res.status(401).json({ error: "Session revoked. Please log in again." });
    }

    return handler(req, res);
  };
}
