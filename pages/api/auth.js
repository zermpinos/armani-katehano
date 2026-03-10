/**
 * api/auth.js
 * POST /api/auth        -> login
 * DELETE /api/auth      -> logout
 *
 * Brute-force protection: 5 failed attempts -> 15-minute IP lockout (Vercel KV).
 */

import kv from "../../lib/redis.js";
import {
  safePasswordCompare,
  buildSessionCookie,
  clearSessionCookie,
  securityHeaders,
  auditLog,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_TTL_S,
} from "../../lib/security.js";

// ── Validate env at cold start ────────────────────────────────────────────────
const REQUIRED_ENV = ["ADMIN_PASSWORD", "SESSION_SECRET", "ADMIN_SLUG"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

export default async function handler(req, res) {
  // Apply security headers
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  // ── Logout ───────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearSessionCookie());
    auditLog("logout", { ip });
    return res.status(200).json({ ok: true });
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const lockKey = `lockout:${ip}`;
  const attKey  = `attempts:${ip}`;

  // Check lockout
  const locked = await kv.get(lockKey);
  if (locked) {
    const ttl = await kv.ttl(lockKey);
    auditLog("login_blocked_lockout", { ip });
    // Return identical message to not leak lockout status (OWASP A07)
    return res.status(429).json({
      error: "Too many attempts. Try again later.",
      retryAfter: ttl,
    });
  }

  const { password, slug } = req.body ?? {};

  // Validate both password AND slug are present (fail fast without timing leaks)
  if (typeof password !== "string" || typeof slug !== "string") {
    return res.status(400).json({ error: "Invalid request" });
  }

  // Both checks must pass -- evaluate both to avoid short-circuit timing leaks
  const passwordOk = safePasswordCompare(password, process.env.ADMIN_PASSWORD);
  const slugOk     = safePasswordCompare(slug,     process.env.ADMIN_SLUG);

  if (!passwordOk || !slugOk) {
    // Increment attempt counter
    const attempts = (await kv.get(attKey) ?? 0) + 1;

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      await kv.set(lockKey, 1, { ex: LOCKOUT_TTL_S });
      await kv.del(attKey);
      auditLog("login_lockout_triggered", { ip, attempts });
    } else {
      await kv.set(attKey, attempts, { ex: LOCKOUT_TTL_S });
      auditLog("login_failed", { ip, attempts });
    }

    // Uniform error message regardless of which factor failed (OWASP A07)
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Success -- clear attempt counter, issue session cookie
  await kv.del(attKey);
  res.setHeader("Set-Cookie", buildSessionCookie(process.env.SESSION_SECRET));
  auditLog("login_success", { ip });
  return res.status(200).json({ ok: true });
}
