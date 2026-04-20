import { verifyPayload, getSessionToken, SESSION_TTL_S } from "@/server/auth/session";
import { securityHeaders }                              from "@/server/security/headers";
import { auditLog }                                     from "@/server/security/audit-log";
import { csrfCheck, csrfTokenCheck }                    from "@/server/auth/csrf";
import { getClientIp }                                  from "@/server/security/client-ip";

export function requireAuth(handler: (req: any, res: any) => any) {
  return async function (req: any, res: any) {
    Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

    const ip = getClientIp(req);

    if (!csrfCheck(req, { strict: true })) {
      auditLog("csrf_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!csrfTokenCheck(req)) {
      auditLog("csrf_token_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }

    const token   = getSessionToken(req);
    const payload = token ? verifyPayload(token) : null;

    if (!payload) {
      auditLog("unauthorized_api_access", { ip, path: req.url, method: req.method });
      return res.status(401).json({ error: "Unauthorized" });
    }

    let parsed;
    try { parsed = JSON.parse(payload); } catch {
      auditLog("invalid_session_payload", { ip, path: req.url });
      return res.status(401).json({ error: "Invalid session" });
    }

    if (!parsed?.ts || Date.now() - parsed.ts > SESSION_TTL_S * 1000) {
      auditLog("expired_session", { ip, path: req.url, ts: parsed?.ts, user: parsed?.user });
      return res.status(401).json({ error: "Session expired" });
    }

    req.adminUser = parsed.user ?? "admin";
    return handler(req, res);
  };
}
