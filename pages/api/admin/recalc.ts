/**
 * pages/api/admin/recalc.js
 * POST /api/admin/recalc
 *
 * One-shot endpoint to recompute PlayerSeasonAggregate for every
 * SeasonLeague in the database. Call this once after deploying the
 * effAvg migration to backfill historical EFF values.
 *
 * Protected by requireAuth - same as all other admin endpoints.
 */

import { requireAuth }       from '@/server/auth';
import prisma                from "@/server/db/client";
import { recalcAggregates }  from "@/server/services/stats-recalc";
import { invalidateForRecalc } from "@/server/services/cache-invalidation";
import { handleError }       from "@/server/http/handle-error";
import { prodError }         from "@/domain/shared/format";

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
        console.error(`[admin/recalc] ${label} failed:`, err);
        results.push({ label, status: "error", message: prodError(err) });
      }
    }

    const failed = results.filter(r => r.status === "error");

    await invalidateForRecalc({ revalidate: (p) => res.revalidate(p) });

    return res.status(failed.length > 0 ? 500 : 200).json({
      ...(failed.length > 0 && {
        error: `${failed.length} of ${results.length} season leagues failed to recalculate`,
      }),
      recalculated: results.length,
      failed:       failed.length,
      results,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

export default requireAuth(handler);
