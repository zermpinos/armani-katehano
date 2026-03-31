/**
 * pages/api/admin/data.js
 * GET /api/admin/data → returns all data needed to bootstrap the admin panel.
 *
 * A-01 fix: the stats shape now includes the full set of fields (fg2Pct, fg3Pct,
 * ftPct, eff, orpg, drpg, tpg) that were previously omitted from the inline
 * reimplementation. This makes the admin panel consistent with the public site
 * and gives the import page everything it needs to resolve and display stats.
 *
 * R-01 fix: tpPct (DB column name) is mapped to fg3Pct (application convention)
 * at the shaping boundary here, so all consumers above this layer use fg3Pct.
 */

import { requireAuth }     from "../../../lib/requireAuth.js";
import { securityHeaders } from "../../../lib/security.js";
import { prodError }       from "../../../lib/utils.js";
import { calcEff }         from "../../../lib/stats.js";
import prisma              from "../../../lib/prisma.js";

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [seasons, players, leagues] = await Promise.all([
      prisma.season.findMany({ orderBy: { year: "desc" } }),
      prisma.player.findMany({ orderBy: { number: "asc" } }),
      prisma.league.findMany({ orderBy: { name:  "asc" } }),
    ]);

    const currentSeason = seasons[0];

    const seasonLeagues = currentSeason ? await prisma.seasonLeague.findMany({
      where:   { seasonId: currentSeason.id },
      include: { league: true },
    }) : [];

    const seasonLeagueIds = seasonLeagues.map(sl => sl.id);

    const games = seasonLeagueIds.length ? await prisma.game.findMany({
      where:   { seasonLeagueId: { in: seasonLeagueIds } },
      include: {
        seasonLeague: { include: { league: true } },
        playerStats:  true,
      },
      orderBy: { playedOn: "desc" },
      take:    200,
    }) : [];

    const aggregates = seasonLeagueIds.length ? await prisma.playerSeasonAggregate.findMany({
      where: { seasonLeagueId: { in: seasonLeagueIds } },
    }) : [];

    // ── Shape stats ─────────────────────────────────────────────────────────
    // A-01 fix: include the full stat set, not just the 9-field subset.
    // R-01 fix: map tpPct (Prisma/DB name) → fg3Pct (app-layer convention).
    const statsMap = {};
    for (const agg of aggregates) {
      const pid = agg.playerId;
      if (!statsMap[pid]) {
        statsMap[pid] = {
          ppg:    +agg.ptsAvg.toFixed(1),
          rpg:    +agg.rebAvg.toFixed(1),
          orpg:   +agg.orbAvg.toFixed(1),
          drpg:   +agg.drbAvg.toFixed(1),
          apg:    +agg.astAvg.toFixed(1),
          spg:    +agg.stlAvg.toFixed(1),
          bpg:    +agg.blkAvg.toFixed(1),
          tpg:    +agg.toAvg.toFixed(1),
          fpg:    +agg.pfAvg.toFixed(1),
          mpg:    +agg.minutesAvg.toFixed(1),
          fgPct:  +agg.fgPct.toFixed(1),
          fg2Pct: +agg.fg2Pct.toFixed(1),
          fg3Pct: +agg.tpPct.toFixed(1),   // R-01: tpPct in DB → fg3Pct in app
          ftPct:  +agg.ftPct.toFixed(1),
          tsPct:  +agg.tsPct.toFixed(1),
          effAvg: +agg.effAvg.toFixed(1),
          gp:     agg.gp,
        };
        continue;
      }
      // Weighted average across multiple SeasonLeagues in the same season.
      const prev    = statsMap[pid];
      const totalGp = prev.gp + agg.gp;
      const wavg    = (a, b) =>
        totalGp > 0 ? +((a * prev.gp + b * agg.gp) / totalGp).toFixed(1) : 0;
      statsMap[pid] = {
        ppg:    wavg(prev.ppg,    agg.ptsAvg),
        rpg:    wavg(prev.rpg,    agg.rebAvg),
        orpg:   wavg(prev.orpg,   agg.orbAvg),
        drpg:   wavg(prev.drpg,   agg.drbAvg),
        apg:    wavg(prev.apg,    agg.astAvg),
        spg:    wavg(prev.spg,    agg.stlAvg),
        bpg:    wavg(prev.bpg,    agg.blkAvg),
        tpg:    wavg(prev.tpg,    agg.toAvg),
        fpg:    wavg(prev.fpg,    agg.pfAvg),
        mpg:    wavg(prev.mpg,    agg.minutesAvg),
        fgPct:  wavg(prev.fgPct,  agg.fgPct),
        fg2Pct: wavg(prev.fg2Pct, agg.fg2Pct),
        fg3Pct: wavg(prev.fg3Pct, agg.tpPct),  // R-01: tpPct in DB → fg3Pct in app
        ftPct:  wavg(prev.ftPct,  agg.ftPct),
        tsPct:  wavg(prev.tsPct,  agg.tsPct),
        effAvg: wavg(prev.effAvg, agg.effAvg),
        gp:     totalGp,
      };
    }

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
      boxScore: g.playerStats.map(r => ({
        playerId: r.playerId,
        pid:      r.playerId,
        min:      r.minutes,
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
      schedule: [],
    });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);