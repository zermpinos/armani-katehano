/**
 * pages/api/admin/recalc.js
 * POST /api/admin/recalc
 *
 * One-shot endpoint to recompute PlayerSeasonAggregate for every
 * SeasonLeague in the database. Call this once after deploying the
 * effAvg migration to backfill historical EFF values.
 *
 * Protected by requireAuth — same as all other admin endpoints.
 */

import { requireAuth }       from '../../../lib/requireAuth';
import prisma                from "@/server/db/client";
import { recalcAggregates }  from "@/server/services/stats-recalc";

async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const seasonLeagues = await prisma.seasonLeague.findMany({
      include: {
        league: true,
        season: true,
      },
    });

    const results: any[] = [];

    for (const sl of seasonLeagues) {
      const label = `${sl.season.name} / ${sl.league.slug}`;
      try {
        await recalcAggregates(sl.id);
        results.push({ label, status: "ok" });
      } catch (err) {
        results.push({ label, status: "error", message: (err as any).message });
      }
    }

    const failed = results.filter(r => r.status === "error");

    const pagesToRevalidate = ["/", "/players", "/leaderboard", "/games", "/team-stats"];
    await Promise.allSettled(pagesToRevalidate.map(p => res.revalidate(p)));

    return res.status(200).json({
      recalculated: results.length,
      failed:       failed.length,
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as any).message });
  }
}

export default requireAuth(handler);
