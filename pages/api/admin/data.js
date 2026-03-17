/**
 * pages/api/admin/data.js
 * GET /api/admin/data → returns all data needed to bootstrap the admin panel
 */

import { requireAuth }           from "../../../lib/requireAuth.js";
import { securityHeaders }       from "../../../lib/security.js";
import prisma                    from "../../../lib/prisma.js";

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get all seasons, players, leagues
    const [seasons, players, leagues] = await Promise.all([
      prisma.season.findMany({ orderBy: { year: "desc" } }),
      prisma.player.findMany({ orderBy: { number: "asc" } }),
      prisma.league.findMany({ orderBy: { name:  "asc" } }),
    ]);

    const currentSeason = seasons[0];

    // Get SeasonLeagues for current season with their leagues
    const seasonLeagues = currentSeason ? await prisma.seasonLeague.findMany({
      where:   { seasonId: currentSeason.id },
      include: { league: true },
    }) : [];

    // Get all games for current season with box scores
    const seasonLeagueIds = seasonLeagues.map(sl => sl.id);
    const games = seasonLeagueIds.length ? await prisma.game.findMany({
      where:   { seasonLeagueId: { in: seasonLeagueIds } },
      include: {
        seasonLeague: { include: { league: true } },
        playerStats:  true,
      },
      orderBy: { playedOn: "desc" },
    }) : [];

    // Get stats for current season
    const stats = seasonLeagueIds.length ? await prisma.playerSeasonAggregate.findMany({
      where: { seasonLeagueId: { in: seasonLeagueIds } },
    }) : [];

    // Shape stats into { [playerId]: { ppg, rpg, ... } }
    const statsMap = {};
    for (const agg of stats) {
      const pid = agg.playerId;
      if (!statsMap[pid]) {
        statsMap[pid] = {
          ppg:   +agg.ptsAvg.toFixed(1),
          rpg:   +agg.rebAvg.toFixed(1),
          apg:   +agg.astAvg.toFixed(1),
          spg:   +agg.stlAvg.toFixed(1),
          bpg:   +agg.blkAvg.toFixed(1),
          tpg:   +agg.toAvg.toFixed(1),
          fpg:   +agg.pfAvg.toFixed(1),
          mpg:   +agg.minutesAvg.toFixed(1),
          fgPct: +agg.fgPct.toFixed(1),
          gp:    agg.gp,
        };
        continue;
      }
      // Merge multiple SeasonLeagues — weighted average
      const prev    = statsMap[pid];
      const totalGp = prev.gp + agg.gp;
      const wavg    = (a, b) => totalGp > 0 ? +((a * prev.gp + b * agg.gp) / totalGp).toFixed(1) : 0;
      statsMap[pid] = {
        ppg:   wavg(prev.ppg,   agg.ptsAvg),
        rpg:   wavg(prev.rpg,   agg.rebAvg),
        apg:   wavg(prev.apg,   agg.astAvg),
        spg:   wavg(prev.spg,   agg.stlAvg),
        bpg:   wavg(prev.bpg,   agg.blkAvg),
        tpg:   wavg(prev.tpg,   agg.toAvg),
        fpg:   wavg(prev.fpg,   agg.pfAvg),
        mpg:   wavg(prev.mpg,   agg.minutesAvg),
        fgPct: wavg(prev.fgPct, agg.fgPct),
        gp:    totalGp,
      };
    }

    // Shape games into the format the admin panel expects
    const shapedGames = games.map(g => ({
      id:             g.id,
      seasonLeagueId: g.seasonLeagueId,
      date:           g.playedOn.toISOString().split("T")[0],
      opponent:       g.opponent,
      home:           g.location === "home",
      result:         g.result,
      score:          `${g.teamScore}–${g.opponentScore}`,
      league:         g.seasonLeague.league.slug,
      notes:          g.notes ?? "",
      boxScore:       g.playerStats.map(r => ({
        playerId: r.playerId,
        pid:      r.playerId,
        min:      r.minutes,
        minutes:  r.minutes,
        pts:      r.pts,
        reb:      r.reb,
        ast:      r.ast,
        stl:      r.stl,
        blk:      r.blk,
        tov:      r.to,
        pf:       r.pf,
        fgm:      r.fgm,
        fga:      r.fga,
        fg2m:     r.fgm - r.tpm,
        fg2a:     r.fga - r.tpa,
        fg3m:     r.tpm,
        fg3a:     r.tpa,
        ftm:      r.ftm,
        fta:      r.fta,
        orb:      0,
        drb:      0,
        eff:      r.pts + r.reb + r.ast + r.stl + r.blk
                  - (r.fga - r.fgm) - (r.fta - r.ftm) - r.to,
      })),
    }));

    return res.status(200).json({
      currentSeason:  currentSeason?.name ?? null,
      currentSeasonId: currentSeason?.id ?? null,
      seasons:        seasons.map(s => ({ id: s.id, name: s.name, year: s.year })),
      players:        players.map(p => ({
        id:       p.id,
        slug:     p.slug,
        name:     p.name,
        number:   p.number,
        position: p.position,
        height:   p.height ?? "",
        weight:   p.weight ?? "",
        isActive: p.isActive,
      })),
      leagues,
      seasonLeagues:  seasonLeagues.map(sl => ({
        id:        sl.id,
        leagueId:  sl.leagueId,
        seasonId:  sl.seasonId,
        leagueName: sl.league.name,
        leagueSlug: sl.league.slug,
      })),
      games:    shapedGames,
      stats:    statsMap,
      schedule: [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default requireAuth(handler);
