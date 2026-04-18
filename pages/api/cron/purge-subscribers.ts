/**
 * pages/api/cron/purge-subscribers.ts
 *
 * GET -- called daily by Vercel Cron. Enforces two retention rules:
 *   • Unconfirmed subscribers older than 1 day
 *   • Confirmed subscribers with no roster email in over 1 year
 *
 * Auth: Vercel sends Authorization: Bearer <CRON_SECRET> automatically.
 */

import prisma from "../../../lib/prisma";
import { securityHeaders, auditLog } from "../../../lib/security";

const UNCONFIRMED_TTL     = 86_400;         // 1 day in seconds
const CONFIRMED_RETENTION = 365 * 86_400;   // 1 year in seconds

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers["authorization"] ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const unconfirmedCutoff = new Date(Date.now() - UNCONFIRMED_TTL * 1000);
  const retentionCutoff   = new Date(Date.now() - CONFIRMED_RETENTION * 1000);

  try {
    const { count: unconfirmedDeleted } = await prisma.subscriber.deleteMany({
      where: { confirmedAt: null, createdAt: { lt: unconfirmedCutoff } },
    });

    const { count: expiredDeleted } = await prisma.subscriber.deleteMany({
      where: {
        confirmedAt: { not: null },
        OR: [
          { lastEmailedAt: { lt: retentionCutoff } },
          { lastEmailedAt: null, confirmedAt: { not: null, lt: retentionCutoff } },
        ],
      },
    });

    auditLog("cron_purge_subscribers", { unconfirmedDeleted, expiredDeleted });
    return res.status(200).json({ ok: true, unconfirmedDeleted, expiredDeleted });
  } catch (err) {
    console.error("[purge-subscribers]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
