/**
 * pages/api/admin/cleanup.js
 * DELETE /api/admin/cleanup
 *
 * Purges expired LoginAttempt rows from the database.
 * Called on a schedule by Vercel Cron (see vercel.json).
 *
 * S-06: Without this job the LoginAttempt table grows unboundedly.
 * The brute-force lockout check (isLockedOut) scans this table on
 * every login attempt - unbounded growth degrades its performance.
 *
 * Security: protected by a shared secret in the Authorization header
 * so it cannot be triggered by arbitrary callers.
 * The secret must match CRON_SECRET in Vercel Environment Variables.
 *
 * Vercel automatically sets Authorization: Bearer <CRON_SECRET> on
 * cron-triggered requests when CRON_SECRET is configured - no manual
 * header management is needed for the cron invocation.
 */

import prisma from "@/server/db/client";
import crypto from "node:crypto";
import { purgeUnconfirmedSubscribers } from "@/server/services/subscriber";


// Every guard sharing LoginAttempt reads back over its own window: 15 min IP
// lockout, 1 h account lockout, 1 h subscribe and blast limits, 24 h per-email
// cooldown. Purging at anything shorter than the longest silently disarms it.
const RETENTION_MS = 24 * 60 * 60 * 1000;

export default async function handler(req: any, res: any) {
  // Only allow DELETE (or GET - Vercel cron uses GET by default)
  if (req.method !== "DELETE" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Auth: verify the cron secret ─────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.length < 32) {
    // Log server-side but return the same generic 403 as an auth failure
    // so misconfiguration is not distinguishable from a wrong token.
    console.error("[cleanup] CRON_SECRET is not set or too short - endpoint disabled");
    return res.status(403).json({ error: "Forbidden" });
  }

  const authHeader = req.headers.authorization ?? "";
  const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  // S-02: Use timingSafeEqual instead of !== to prevent timing side-channel attacks.
  // timingSafeEqual throws if the two buffers have different byte lengths, so the
  // length check must come first - a mismatched length is itself an auth failure.
  const a = Buffer.from(token || '', 'utf8');
  const b = Buffer.from(cronSecret || '', 'utf8');
  
  const tokenValid =
    a.length === b.length && crypto.timingSafeEqual(a, b);
  
  if (!tokenValid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── Purge expired rows ───────────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - RETENTION_MS);

    const [loginResult, unconfirmedCount, challengeResult] = await Promise.all([
      prisma.loginAttempt.deleteMany({ where: { attemptedAt: { lt: cutoff } } }),
      purgeUnconfirmedSubscribers(),
      prisma.webAuthnChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    ]);

    console.log(
      `[cleanup] Purged ${loginResult.count} LoginAttempt rows, ` +
      `${unconfirmedCount} unconfirmed Subscriber rows, ` +
      `${challengeResult.count} expired WebAuthnChallenge rows`
    );

    return res.status(200).json({
      ok:                   true,
      deletedLoginAttempts: loginResult.count,
      deletedSubscribers:   unconfirmedCount,
      deletedChallenges:    challengeResult.count,
      cutoff:               cutoff.toISOString(),
    });
  } catch (err) {
    console.error("[cleanup] Purge failed:", err);
    return res.status(500).json({ error: "Cleanup failed" });
  }
}