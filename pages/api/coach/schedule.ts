/**
 * pages/api/coach/schedule.ts
 * GET /api/coach/schedule -> list upcoming games (read-only, coach-auth)
 */

import { requireCoachAuth } from "@/server/auth";
import prisma from "@/server/db/client";
import { prodError } from "@/domain/shared/format";
import { getAllGames } from "@/server/db/repositories";
import { headToHead, type HeadToHead } from "@/domain/stats/head-to-head";

async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const schedule = await prisma.upcomingGame.findMany({
      where:   { scheduledFor: { gte: new Date() } },
      orderBy: { scheduledFor: "asc" },
    });
    let headToHeadList: HeadToHead[] = [];
    if (schedule.length) {
      try {
        const games     = await getAllGames();
        const opponents = [...new Set(schedule.map(g => g.opponent))];
        headToHeadList  = opponents.map(o => headToHead(games, o, { limit: 3 }));
      } catch (err) {
        // Head-to-head is an extra; the roster announcement must never depend on it.
        console.error("[coach/schedule] head-to-head:", err);
      }
    }
    return res.status(200).json({ schedule, headToHead: headToHeadList });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireCoachAuth(handler);
