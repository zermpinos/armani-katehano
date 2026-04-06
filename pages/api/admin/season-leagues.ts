/**
 * pages/api/admin/season-leagues.js
 * GET /api/admin/season-leagues → list all season+league combinations
 *
 * Returns the data the import page needs to populate the league dropdown.
 */

import { requireAuth }               from "../../../lib/requireAuth.js";
import { securityHeaders, auditLog } from "../../../lib/security";
import { prodError }                 from "../../../lib/utils";
import prisma                        from "../../../lib/prisma";

async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const seasonLeagues = await prisma.seasonLeague.findMany({
      include: {
        league: true,
        season: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      seasonLeagues: seasonLeagues.map(sl => ({
        id:          sl.id,
        leagueId:    sl.leagueId,
        seasonId:    sl.seasonId,
        leagueName:  sl.league.name,
        leagueSlug:  sl.league.slug,
        seasonName:  sl.season.name,
        seasonYear:  sl.season.year,
      })),
    });
  } catch (err) {
    auditLog("season_leagues_fetch_error", { error: (err as any).message });
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);