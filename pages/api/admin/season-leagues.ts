/**
 * pages/api/admin/season-leagues.js
 * GET /api/admin/season-leagues                        -> open season+league pairs
 * GET /api/admin/season-leagues?includeArchived=true   -> every pair, for managing seasons
 *
 * Returns the data the import page needs to populate the league dropdown.
 */

import { requireAuth }               from "@/server/auth";
import { auditLog }                  from "@/server/security/node";
import { prodError }                 from "@/domain/shared/format";
import prisma                        from "@/server/db/client";

async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // An archived season is closed, so a game must never be filed into one. That
  // is already the rule resolverInputs and discoverGames enforce; leaving the
  // archived pairs in this list let a hand import contradict it, and the league
  // name alone repeats once per season, so the closed twin was unrecognisable.
  // Managing seasons is the one job that needs them, and it asks.
  const includeArchived = req.query.includeArchived === "true";

  try {
    const seasonLeagues = await prisma.seasonLeague.findMany({
      where: includeArchived ? {} : { season: { archivedAt: null } },
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