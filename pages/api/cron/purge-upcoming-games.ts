/**
 * pages/api/cron/purge-upcoming-games.ts
 *
 * GET - daily cron. Deletes UpcomingGame rows whose scheduledFor is in the
 * past AND whose linked GameImportJob has reached a terminal state
 * (IMPORTED or ABANDONED).
 *
 * Stuck rows (PENDING / ERROR / no job) are left in place so an admin can
 * still inspect or retry them via /api/admin/schedule.
 *
 * Cascade: deleting an UpcomingGame cascades to its GameImportJob and
 * GameRosterAnnouncement; the imported Game itself is preserved
 * (importedGameId uses onDelete: SetNull).
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
        importJob:    { is: { state: { in: ["IMPORTED", "ABANDONED"] } } },
      },
    });

    auditLog("cron_purge_upcoming_games", { deleted: count });
    return res.status(200).json({ ok: true, deleted: count });
  } catch (err) {
    console.error("[purge-upcoming-games]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
