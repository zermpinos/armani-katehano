/**
 * pages/api/coach/auth.ts
 *
 * GET    /api/coach/auth  -> 200 if coach session valid, 401 otherwise
 * POST   /api/coach/auth  -> validate coach password, set coach session cookie
 * DELETE /api/coach/auth  -> clear coach session cookie (logout)
 *
 * Uses a separate cookie (__Host-ak_coach) and COACH_PASSWORD env var.
 * Brute-force lockout reuses the shared LoginAttempt table (5 attempts -> 15 min).
 */

import * as Sentry from "@sentry/nextjs";
import { isLockedOut, atomicRecordAndCheck, clearAttempts, getFailureCount } from "@/server/auth";
import { csrfCheck, CAPTCHA_THRESHOLD, verifyCaptcha, generateCsrfToken, buildCsrfCookie, clearCsrfCookie } from "@/server/auth";
import { securityHeaders } from "@/server/security/edge";
import { auditLog, getClientIp } from "@/server/security/node";
import {
  getCoachSessionToken,
  verifyCoachSession,
  verifyCoachPassword,
  getCoachSessionVersion,
  buildCoachSessionCookie,
  clearCoachSessionCookie,
  COACH_SESSION_TTL_S,
} from "@/server/auth";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const ip = getClientIp(req);

  // ── GET: check session ────────────────────────────────────────────────────
  if (req.method === "GET") {
    const token   = getCoachSessionToken(req);
    const payload = verifyCoachSession(token);
    if (!payload) return res.status(401).json({ error: "Not authenticated" });

    let parsed: any;
    try { parsed = JSON.parse(payload); } catch {
      return res.status(401).json({ error: "Invalid session" });
    }
    if (parsed?.role !== "coach") return res.status(401).json({ error: "Unauthorized" });
    if (!parsed?.ts || Date.now() - parsed.ts > COACH_SESSION_TTL_S * 1000) {
      return res.status(401).json({ error: "Session expired" });
    }
    const currentVersion = await getCoachSessionVersion();
    if ((parsed.v ?? 0) !== currentVersion) {
      return res.status(401).json({ error: "Session revoked. Please log in again." });
    }
    return res.status(200).json({ ok: true });
  }

  // ── DELETE: logout ────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", [clearCoachSessionCookie(), clearCsrfCookie()]);
    auditLog("coach_logout", { ip });
    return res.status(200).json({ ok: true });
  }

  // ── POST: login ───────────────────────────────────────────────────────────
  if (req.method === "POST") {
    if (!csrfCheck(req, { strict: true })) {
      auditLog("coach_csrf_rejected", { ip });
      return res.status(403).json({ error: "Forbidden" });
    }

    const { password } = req.body ?? {};
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Password is required" });
    }

    // Brute-force lockout - per-IP
    const locked = await isLockedOut(ip);
    if (locked) {
      auditLog("coach_login_locked", { ip });
      return res.status(429).json({ error: "Too many failed attempts. Try again later.", retryAfter: 900 });
    }

    // Brute-force lockout - per-account (H-2): 25 attempts across any IP, 1-hour window
    const ACCOUNT_KEY = "account_coach";
    const accountLocked = await isLockedOut(ACCOUNT_KEY, 25, 3600);
    if (accountLocked) {
      auditLog("coach_login_account_locked", { ip });
      Sentry.captureMessage("Coach account lockout triggered", { level: "warning" });
      return res.status(429).json({ error: "Too many attempts across all clients. Try again in an hour.", retryAfter: 3600 });
    }

    // CAPTCHA required after CAPTCHA_THRESHOLD IP failures
    const { captchaToken } = req.body ?? {};
    const ipFailCount = await getFailureCount(ip);
    if (ipFailCount >= CAPTCHA_THRESHOLD) {
      if (!captchaToken || typeof captchaToken !== "string") {
        return res.status(401).json({ error: "Captcha required", requiresCaptcha: true });
      }
      const captchaOk = await verifyCaptcha(captchaToken, ip);
      if (!captchaOk) {
        const [ipRes, accountRes] = await Promise.all([
          atomicRecordAndCheck(ip),
          atomicRecordAndCheck(ACCOUNT_KEY, 25, 3600),
        ]);
        if (ipRes.locked) {
          auditLog("coach_login_locked", { ip });
          return res.status(429).json({ error: "Too many failed attempts. Try again later.", retryAfter: 900 });
        }
        if (accountRes.locked) {
          auditLog("coach_login_account_locked", { ip });
          return res.status(429).json({ error: "Too many attempts across all clients. Try again in an hour.", retryAfter: 3600 });
        }
        auditLog("coach_login_captcha_failed", { ip });
        return res.status(401).json({ error: "Captcha verification failed", requiresCaptcha: true });
      }
    }

    const valid = await verifyCoachPassword(password);
    if (!valid) {
      const [ipRes, accountRes] = await Promise.all([
        atomicRecordAndCheck(ip),
        atomicRecordAndCheck(ACCOUNT_KEY, 25, 3600),
      ]);
      if (ipRes.locked) {
        auditLog("coach_login_locked", { ip });
        return res.status(429).json({ error: "Too many failed attempts. Try again later.", retryAfter: 900 });
      }
      if (accountRes.locked) {
        auditLog("coach_login_account_locked", { ip });
        return res.status(429).json({ error: "Too many attempts across all clients. Try again in an hour.", retryAfter: 3600 });
      }
      auditLog("coach_login_failed", { ip });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await Promise.all([clearAttempts(ip), clearAttempts(ACCOUNT_KEY)]);
    const v = await getCoachSessionVersion();
    const payload = JSON.stringify({ ts: Date.now(), role: "coach", v });
    res.setHeader("Set-Cookie", [buildCoachSessionCookie(payload), buildCsrfCookie(generateCsrfToken())]);
    auditLog("coach_login_success", { ip });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
