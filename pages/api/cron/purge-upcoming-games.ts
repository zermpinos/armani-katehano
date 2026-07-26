/**
 * pages/api/cron/purge-upcoming-games.ts
 *
 * GET - daily cron. Deletes past UpcomingGame rows whose sourceUrl belongs to
 * a game that was actually imported.
 *
 * A set sourceUrl is not evidence of an import. The poll needs the URL on the
 * fixture before the game so it has something to scrape, so deleting on the
 * field alone destroys the rows it retries against, and the admin's
 * quick-import list with them.
 *
 * Past rows with no sourceUrl, or with one no game was created from, stay put
 * so the game can still be imported.
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
    const past = await prisma.upcomingGame.findMany({
      where:  { scheduledFor: { lt: new Date() }, sourceUrl: { not: null } },
      select: { id: true, sourceUrl: true },
    });

    let count = 0;
    if (past.length) {
      const imported = new Set(
        (await prisma.game.findMany({
          where:  { sourceUrl: { in: past.map(p => p.sourceUrl as string) } },
          select: { sourceUrl: true },
        })).map(g => g.sourceUrl),
      );
      const ids = past.filter(p => imported.has(p.sourceUrl)).map(p => p.id);
      if (ids.length)
        ({ count } = await prisma.upcomingGame.deleteMany({ where: { id: { in: ids } } }));
    }

    auditLog("cron_purge_upcoming_games", { deleted: count });
    return res.status(200).json({ ok: true, deleted: count });
  } catch (err) {
    console.error("[purge-upcoming-games]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
