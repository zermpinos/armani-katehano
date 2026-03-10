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
} from "../security.js";

export function requireAuth(handler) {
  return async function (req, res) {
    // Apply security headers to every response
    Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

    const token   = getSessionToken(req.headers.cookie);
    const payload = token ? verifyPayload(token, process.env.SESSION_SECRET) : null;

    if (!payload) {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";
      auditLog("unauthorized_api_access", {
        ip,
        path: req.url,
        method: req.method,
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    return handler(req, res);
  };
}
