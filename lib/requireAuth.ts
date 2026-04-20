/**
 * lib/requireAuth.js
 * Middleware wrapper for protected API routes.
 * Usage: export default requireAuth(handler)
 */
import {
  verifyPayload,
  getSessionToken,
  securityHeaders,
  auditLog,
  csrfCheck,
  csrfTokenCheck,
  getClientIp,
  SESSION_TTL_S, // S-06: imported to enforce TTL server-side
} from "./security";

export function requireAuth(handler: (req: any, res: any) => any) {
  return async function (req: any, res: any) {
    // Apply security headers to every response
    Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

    const ip = getClientIp(req);

    // ── CSRF check ────────────────────────────────────────────────────────────
    if (!csrfCheck(req, { strict: true })) {
      auditLog("csrf_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!csrfTokenCheck(req)) {
      auditLog("csrf_token_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }

    // ── Session check ─────────────────────────────────────────────────────────
    const token   = getSessionToken(req);
    const payload = token ? verifyPayload(token) : null;
  
    if (!payload) {
      auditLog("unauthorized_api_access", { ip, path: req.url, method: req.method });
      return res.status(401).json({ error: "Unauthorized" });
    }

    // S-06: Enforce TTL server-side (cookie replay defence).
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch {
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