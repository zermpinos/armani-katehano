import "@/server/_internal/node-only";
import { verifyPayload, getSessionToken, SESSION_TTL_S } from "@/server/auth/session";
import { securityHeaders }                              from "@/server/security/edge/headers";
import { auditLog }                                     from "@/server/security/node/audit-log";
import { csrfCheck, csrfTokenCheck }                    from "@/server/auth/csrf";
import { getClientIp }                                  from "@/server/security/node/client-ip";

export function requireAuth(handler: (req: any, res: any) => any) {
  return async function (req: any, res: any) {
    Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

    const ip = getClientIp(req);

    const token   = getSessionToken(req);
    const payload = token ? verifyPayload(token) : null;

    if (!payload) {
      await auditLog("unauthorized_api_access", { ip, path: req.url, method: req.method });
      return res.status(401).json({ error: "Unauthorized" });
    }

    let parsed;
    try { parsed = JSON.parse(payload); } catch {
      await auditLog("invalid_session_payload", { ip, path: req.url });
      return res.status(401).json({ error: "Invalid session" });
    }

    if (!parsed?.ts || Date.now() - parsed.ts > SESSION_TTL_S * 1000) {
      await auditLog("expired_session", { ip, path: req.url, ts: parsed?.ts, user: parsed?.user });
      return res.status(401).json({ error: "Session expired" });
    }

    if (parsed?.role !== "admin") {
      await auditLog("forbidden_role", { ip, path: req.url, role: parsed?.role, user: parsed?.user });
      return res.status(403).json({ error: "Forbidden" });
    }

    // Below the session checks: the token binds to the session, and it makes
    // csrf_blocked an event about a request that carried one, not about every
    // bot probe and CI run that arrives without an origin header.
    if (!csrfCheck(req)) {
      await auditLog("csrf_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!csrfTokenCheck(req, token)) {
      await auditLog("csrf_token_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }

    req.adminUser = parsed.user ?? "admin";
    return handler(req, res);
  };
}
