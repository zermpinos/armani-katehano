/**
 * pages/api/auth.js
 *
 * GET    /api/auth  -> 200 if session is valid, 401 otherwise
 * POST   /api/auth  -> validate password, set session cookie on success
 * DELETE /api/auth  -> clear session cookie (logout)
 *
 * S-03: Now uses verifyPassword() (bcrypt) from lib/security.
 *       ADMIN_PASSWORD must be stored as a bcrypt hash in Vercel env vars.
 *       Generate: node -e "require('bcryptjs').hash('YOUR_PW',12).then(console.log)"
 */

import * as Sentry from "@sentry/nextjs";
import { isLockedOut, recordAttempt, clearAttempts, getFailureCount } from "../../lib/loginAttempts";
import { getSessionToken, verifyPayload, verifyCredentials, getAdminUser, verifyTotp, buildSessionCookie, clearSessionCookie, securityHeaders, auditLog, csrfCheck, getClientIp, CAPTCHA_THRESHOLD, verifyCaptcha } from "../../lib/security";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const ip = getClientIp(req);

  // ── GET: check existing session ───────────────────────────────────────────
  if (req.method === "GET") {
    const token   = getSessionToken(req);
    const payload = verifyPayload(token);
    if (payload) return res.status(200).json({ ok: true });
    return res.status(401).json({ error: "Not authenticated" });
  }

  // ── DELETE: logout ────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const token   = getSessionToken(req);
    const payload = verifyPayload(token);
    let logoutUser: string | undefined;
    try { logoutUser = payload ? JSON.parse(payload).user : undefined; } catch { /* ignore */ }
    res.setHeader("Set-Cookie", clearSessionCookie());
    auditLog("logout", { ip, username: logoutUser });
    return res.status(200).json({ ok: true });
  }

  // ── POST: login ───────────────────────────────────────────────────────────
  if (req.method === "POST") {
    if (!csrfCheck(req, { strict: true })) {
      auditLog("csrf_rejected", { ip });
      return res.status(403).json({ error: "Forbidden" });
    }

    const { username, password, totpToken, slug } = req.body ?? {};
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Username is required" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Password is required" });
    }

    // Brute-force lockout -- per-IP
    const locked = await isLockedOut(ip);
    if (locked) {
      auditLog("login_locked", { ip });
      return res.status(429).json({ error: "Too many failed attempts. Try again later.", retryAfter: 900 });
    }

    // Brute-force lockout -- per-account: 25 attempts across any IP, 1-hour window
    const ACCOUNT_KEY = `account_${username}`;
    const accountLocked = await isLockedOut(ACCOUNT_KEY, 25, 3600);
    if (accountLocked) {
      auditLog("login_account_locked", { ip, username });
      Sentry.captureMessage("Admin account lockout triggered", { level: "warning", extra: { username } });
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
        await Promise.all([recordAttempt(ip), recordAttempt(ACCOUNT_KEY)]);
        auditLog("login_captcha_failed", { ip, username });
        return res.status(401).json({ error: "Captcha verification failed", requiresCaptcha: true });
      }
    }

    const valid = await verifyCredentials(username, password);
    if (!valid) {
      await Promise.all([recordAttempt(ip), recordAttempt(ACCOUNT_KEY)]);
      auditLog("login_failed", { ip, username });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // TOTP check -- required if the user has a totpSecret configured
    const userRecord = getAdminUser(username);
    if (userRecord?.totpSecret) {
      if (!totpToken || typeof totpToken !== "string" || !verifyTotp(userRecord.totpSecret, totpToken)) {
        auditLog("login_totp_failed", { ip, username });
        return res.status(401).json({ error: "Invalid authenticator code" });
      }
    }

    await Promise.all([clearAttempts(ip), clearAttempts(ACCOUNT_KEY)]);
    const payload = JSON.stringify({ ts: Date.now(), role: "admin", user: username });
    res.setHeader("Set-Cookie", buildSessionCookie(payload));
    auditLog("login_success", { ip, slug, username });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}