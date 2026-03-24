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
} from "./security.js";

/** Mutating HTTP methods that require CSRF protection. */
const CSRF_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

/**
 * Returns true if the request passes the CSRF origin check.
 * GET/HEAD/OPTIONS are exempt -- they must be read-only.
 * For mutating methods, the Origin or Referer must match the host.
 */
function passesCSRF(req) {
  if (!CSRF_METHODS.has(req.method)) return true;

  const host   = req.headers["host"] ?? "";
  const origin = req.headers["origin"] ?? "";
  const referer = req.headers["referer"] ?? "";

  // Check Origin header first (present in all modern browsers on cross-origin requests)
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  // Fall back to Referer (older browsers, some same-site navigations)
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  // No Origin and no Referer -- only allow if the request is coming from a
  // non-browser context (e.g. the import scraper, curl). These won't have
  // either header set by a browser. If you need to be stricter here, return false.
  return true;
}

export function requireAuth(handler) {
  return async function (req, res) {
    // Apply security headers to every response
    Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

    // ── CSRF check ────────────────────────────────────────────────────────────
    if (!passesCSRF(req)) {
      auditLog("csrf_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }

    // ── Session check ─────────────────────────────────────────────────────────
    const token = getSessionToken(req);                  // ← pass the req object, as auth.js does correctly
    const payload = token ? verifyPayload(token) : null; // ← remove the ignored second arg (also fixes B-04)
    if (!payload) {
      auditLog("unauthorized_api_access", { ip, path: req.url, method: req.method });
      return res.status(401).json({ error: "Unauthorized" });
    }

    return handler(req, res);
  };
}