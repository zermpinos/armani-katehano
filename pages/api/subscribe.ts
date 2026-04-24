/**
 * pages/api/subscribe.ts  (public -- no auth required)
 *
 * POST  { email }               -> subscribe
 * DELETE { token }              -> unsubscribe via token (linked from emails)
 */

import { randomBytes } from "crypto";
import prisma from "@/server/db/client";
import { prodError } from "@/domain/shared/format";
import { csrfCheck } from "@/server/auth";
import { securityHeaders, getClientIp, auditLog } from "@/server/security";
import { rlKey } from "@/server/auth";
import { sendConfirmationEmail } from "@/server/integrations/email/client";
import { SubscribeSchema, UnsubscribeSchema } from "@/schemas/subscriber";

const SUBSCRIBE_LIMIT        = 3;       // max attempts per IP per hour
const SUBSCRIBE_WINDOW       = 3600;    // 1 hour in seconds
const EMAIL_COOLDOWN_WINDOW  = 86400;   // 24 hours in seconds
const UNCONFIRMED_TTL        = 86400;         // 1 day in seconds
const CONFIRMED_RETENTION    = 365 * 86400;   // 1 year in seconds

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const ip = getClientIp(req);
  const rateLimitKey = rlKey(`sub_${ip}`);

  // ── SUBSCRIBE ──────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    if (!csrfCheck(req, { strict: true })) {
      auditLog("subscribe_csrf_blocked", { ip, path: req.url });
      return res.status(403).json({ error: "Forbidden" });
    }
    // Rate-limit: max 3 subscribe attempts per IP per hour
    const since = new Date(Date.now() - SUBSCRIBE_WINDOW * 1000);
    const attempts = await prisma.loginAttempt.count({
      where: { ip: rateLimitKey, attemptedAt: { gte: since } },
    });
    if (attempts >= SUBSCRIBE_LIMIT) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }

    const parsed = SubscribeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    const { email } = parsed.data;

    // Record attempt before processing (asynchronous)
    prisma.loginAttempt.create({ data: { ip: rateLimitKey } })
      .catch((err: unknown) => console.error("[subscribe] rate-limit record failed:", err));

    // Per-email cooldown: reject if the same address attempted within the last 24 h.
    // Prevents IP-rotating attackers from flooding a victim's inbox.
    const emailKey = rlKey(`subemail_${email}`);
    const emailSince = new Date(Date.now() - EMAIL_COOLDOWN_WINDOW * 1000);
    const emailAttempts = await prisma.loginAttempt.count({
      where: { ip: emailKey, attemptedAt: { gte: emailSince } },
    });
    if (emailAttempts >= 1) {
      // Return 200 so we don't reveal whether the address is known
      return res.status(200).json({ ok: true });
    }
    // Purge stale records (asynchronous, runs on each subscribe attempt)
    const unconfirmedCutoff = new Date(Date.now() - UNCONFIRMED_TTL * 1000);
    const retentionCutoff   = new Date(Date.now() - CONFIRMED_RETENTION * 1000);
    prisma.subscriber.deleteMany({
      where: {
        OR: [
          // Unconfirmed for more than 1 day
          { confirmedAt: null, createdAt: { lt: unconfirmedCutoff } },
          // Confirmed but no roster email in over 1 year
          { confirmedAt: { not: null }, lastEmailedAt: { lt: retentionCutoff } },
          // Confirmed, never emailed, confirmed over 1 year ago
          { confirmedAt: { not: null, lt: retentionCutoff }, lastEmailedAt: null },
        ],
      },
    }).catch((err: unknown) => console.error("[subscribe] purge failed:", err));

    try {
      const existing = await prisma.subscriber.findUnique({ where: { email } });
      if (existing) {
        // Already subscribed -- return success silently (don't reveal existence)
        return res.status(200).json({ ok: true });
      }

      const token = randomBytes(32).toString("hex");
      try {
        await prisma.subscriber.create({
          data: { email, token, confirmedAt: null },
        });
      } catch (createErr: any) {
        // P2002 = unique constraint violation: a concurrent request already inserted
        // this email (race on the cooldown window). Treat as success -- only one email
        // will ever be sent because the first request holds the row.
        if (createErr?.code === "P2002") {
          return res.status(200).json({ ok: true });
        }
        throw createErr;
      }

      const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const confirmUrl = `${appUrl}/api/confirm?token=${token}`;

      try {
        await sendConfirmationEmail({ email, confirmUrl });
      } catch (emailErr) {
        // Roll back the subscriber row so the user can retry cleanly.
        await prisma.subscriber.delete({ where: { token } }).catch(() => {});
        throw emailErr;
      }

      // Only stamp the cooldown after a successful email send so a delivery
      // failure doesn't silently block the user from retrying.
      prisma.loginAttempt.create({ data: { ip: emailKey } })
        .catch((err: unknown) => console.error("[subscribe] email cooldown record failed:", err));

      return res.status(201).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: prodError(err) });
    }
  }

  // ── UNSUBSCRIBE ────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const parsed = UnsubscribeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid unsubscribe token" });
    }
    const { token } = parsed.data;

    try {
      await prisma.subscriber.delete({ where: { token } });
      return res.status(200).json({ ok: true });
    } catch {
      // Token not found -- treat as success to avoid token enumeration
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
