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
  SESSION_TTL_S, // S-06: imported to enforce TTL server-side
} from "./security";

export function requireAuth(handler) {
  return async function (req, res) {
    // Apply security headers to every response
    Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

    // ── CSRF check ────────────────────────────────────────────────────────────
    if (!csrfCheck(req)) {
      auditLog("csrf_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }

    // ── Session check ─────────────────────────────────────────────────────────
    const token   = getSessionToken(req);
    const payload = token ? verifyPayload(token) : null;
  
    if (!payload) {
      auditLog("unauthorized_api_access", { ip, path: req.url, method: req.method });
      return res.status(401).json({ error: "Unauthorized" });
    }

    // S-06: Enforce TTL server-side. The cookie has Max-Age=SESSION_TTL_S but
    // browser expiry can be bypassed by replaying an extracted cookie value.
    // verifyPayload() only checks the HMAC signature -- it does not inspect ts.
    // We parse the payload here and reject anything older than SESSION_TTL_S.
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch {
      auditLog("invalid_session_payload", { ip, path: req.url });
      return res.status(401).json({ error: "Invalid session" });
    }
    
    if (!parsed?.ts || Date.now() - parsed.ts > SESSION_TTL_S * 1000) {
      auditLog("expired_session", { ip, path: req.url, ts: parsed?.ts });
      return res.status(401).json({ error: "Session expired" });
    }
    
    return handler(req, res);
  };
}