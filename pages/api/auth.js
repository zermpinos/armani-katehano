/**
 * api/auth.js
 * POST /api/auth        -> login
 * DELETE /api/auth      -> logout
 *
 * Brute-force protection: 5 failed attempts -> 15-minute IP lockout (Upstash Redis).
 */

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

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
  const locked = await redis.get(lockKey);
  if (locked) {
    const ttl = await redis.ttl(lockKey);
    auditLog("login_blocked_lockout", { ip });
    return res.status(429).json({
      error: "Too many attempts. Try again later.",
      retryAfter: ttl,
    });
  }

  const { password, slug } = req.body ?? {};

  if (typeof password !== "string" || typeof slug !== "string") {
    return res.status(400).json({ error: "Invalid request" });
  }

  const passwordOk = safePasswordCompare(password, process.env.ADMIN_PASSWORD);
  const slugOk     = safePasswordCompare(slug,     process.env.ADMIN_SLUG);

  if (!passwordOk || !slugOk) {
    const attempts = (await redis.get(attKey) ?? 0) + 1;

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      await redis.set(lockKey, 1, { ex: LOCKOUT_TTL_S });
      await redis.del(attKey);
      auditLog("login_lockout_triggered", { ip, attempts });
    } else {
      await redis.set(attKey, attempts, { ex: LOCKOUT_TTL_S });
      auditLog("login_failed", { ip, attempts });
    }

    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Success -- clear attempt counter, issue session cookie
  await redis.del(attKey);
  res.setHeader("Set-Cookie", buildSessionCookie(process.env.SESSION_SECRET));
  auditLog("login_success", { ip });
  return res.status(200).json({ ok: true });
}
