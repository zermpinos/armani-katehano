/**
 * pages/api/cron/purge-upcoming-games.ts
 *
 * GET - daily cron. Deletes UpcomingGame rows whose scheduledFor is in the
 * past AND whose sourceUrl is set (meaning the admin has manually imported
 * the game result and the upcoming entry is no longer needed).
 *
 * Past rows with no sourceUrl are left in place so the admin can still see
 * which games were not imported.
 *
 * Cascade: deleting an UpcomingGame cascades to GameRosterAnnouncement.
 */

import { timingSafeEqual } from "node:crypto";
import prisma              from "@/server/db/client";
import { securityHeaders } from "@/server/security/edge";
import { auditLog }        from "@/server/security/node";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const secret   = process.env.CRON_SECRET;
  const auth     = String(req.headers["authorization"] ?? "");
  const expected = `Bearer ${secret ?? ""}`;
  if (
    !secret ||
    auth.length !== expected.length ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { count } = await prisma.upcomingGame.deleteMany({
      where: {
        scheduledFor: { lt: new Date() },
        sourceUrl:    { not: null },
      },
    });

    auditLog("cron_purge_upcoming_games", { deleted: count });
    return res.status(200).json({ ok: true, deleted: count });
  } catch (err) {
    console.error("[purge-upcoming-games]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
