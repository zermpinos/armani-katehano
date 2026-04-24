/**
 * pages/api/admin/data.js
 * GET /api/admin/data → returns all data needed to bootstrap the admin panel.
 *
 * A-01 fix: the stats shape now includes the full set of fields (fg2Pct, fg3Pct,
 * ftPct, eff, orpg, drpg, tpg) that were previously omitted from the inline
 * reimplementation. This makes the admin panel consistent with the public site
 * and gives the import page everything it needs to resolve and display stats.
 *
 */

import { requireAuth }                  from "@/server/auth";
import { prodError } from "@/domain/shared/format";
import { MAX_GAMES_PER_PAGE } from "@/domain/shared/constants";
import { calcEff, aggregatesToStatsMap } from "@/domain/stats";
import { getAllUpcomingGames }          from "@/server/db/repositories";
import prisma                          from "@/server/db/client";
import { z }                           from "zod";

async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional filter: ?seasonLeagueId=<cuid> scopes games to one season-league.
  const filterParam = req.query.seasonLeagueId;
  if (filterParam && !z.string().cuid().safeParse(filterParam).success) {
    return res.status(400).json({ error: "Invalid seasonLeagueId" });
  }

  try {
    const [seasons, players, leagues, upcomingGames] = await Promise.all([
      prisma.season.findMany({ orderBy: { year: "desc" } }),
      prisma.player.findMany({ orderBy: { number: "asc" } }),
      prisma.league.findMany({ orderBy: { name:  "asc" } }),
      getAllUpcomingGames(),
    ]);

    const currentSeason = seasons[0];

    const seasonLeagues = currentSeason ? await prisma.seasonLeague.findMany({
      where:   { seasonId: currentSeason.id },
      include: { league: true },
    }) : [];

    const seasonLeagueIds = seasonLeagues.map(sl => sl.id);

    // If a specific seasonLeagueId is requested, use it; otherwise scope to current season.
    const gameWhereIds = filterParam ? [filterParam] : seasonLeagueIds;

    const games = gameWhereIds.length ? await prisma.game.findMany({
      where:   { seasonLeagueId: { in: gameWhereIds } },
      include: {
        seasonLeague: { include: { league: true } },
        playerStats:  true,
      },
      orderBy: { playedOn: "desc" },
      take:    MAX_GAMES_PER_PAGE,
    }) : [];

    const aggregates = gameWhereIds.length ? await prisma.playerSeasonAggregate.findMany({
      where: { seasonLeagueId: { in: gameWhereIds } },
    }) : [];

    // ── Shape stats ─────────────────────────────────────────────────────────
    const statsMap = aggregatesToStatsMap(aggregates);

    // ── Shape games ──────────────────────────────────────────────────────────
    // The `date` field is surfaced as a plain ISO string (YYYY-MM-DD) so page
    // components can use g.date without knowing about the Prisma Date object.
    const shapedGames = games.map(g => ({
      id:             g.id,
      seasonLeagueId: g.seasonLeagueId,
      date:           g.playedOn.toISOString().split("T")[0],
      opponent:       g.opponent,
      home:           g.location === "home",
      result:         g.result,
      teamScore:      g.teamScore,
      opponentScore:  g.opponentScore,
      score:          `${g.teamScore}–${g.opponentScore}`,
      league:         g.seasonLeague.league.slug,
      notes:          g.notes ?? "",
      sourceUrl:      g.sourceUrl ?? null,
      youtubeUrl:     g.youtubeUrl ?? null,
      boxScore: g.playerStats.map(r => ({
        playerId: r.playerId,
        minutes:  r.minutes,
        pts:      r.pts,
        reb:      r.reb,
        orb:      r.orb,
        drb:      r.drb,
        ast:      r.ast,
        stl:      r.stl,
        blk:      r.blk,
        tov:      r.tov,
        pf:       r.pf,
        fgm:      r.fgm,
        fga:      r.fga,
        fg2m:     r.fg2m,
        fg2a:     r.fg2a,
        fg3m:     r.fg3m,
        fg3a:     r.fg3a,
        ftm:      r.ftm,
        fta:      r.fta,
        eff:      calcEff(r),
      })),
    }));

    return res.status(200).json({
      currentSeason:   currentSeason?.name ?? null,
      currentSeasonId: currentSeason?.id   ?? null,
      seasons:         seasons.map(s => ({ id: s.id, name: s.name, year: s.year })),
      players:         players.map(p => ({
        id:       p.id,
        slug:     p.slug,
        name:     p.name,
        number:   p.number,
        position: p.position,
        height:   p.height  ?? "",
        weight:   p.weight  ?? "",
        isActive: p.isActive,
      })),
      leagues,
      seasonLeagues: seasonLeagues.map(sl => ({
        id:         sl.id,
        leagueId:   sl.leagueId,
        seasonId:   sl.seasonId,
        leagueName: sl.league.name,
        leagueSlug: sl.league.slug,
      })),
      games:    shapedGames,
      stats:    statsMap,
      upcomingGames,
    });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);