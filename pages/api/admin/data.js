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
    // Merge multi-league aggregates per player.
    // Rate stats: weighted average by gp.
    // Percentage stats: recomputed from summed raw totals (statistically correct).
    // This mirrors the approach in lib/repository.prisma.js:getStats().
    const merged = {};
    for (const agg of aggregates) {
      const pid = agg.playerId;
      if (!merged[pid]) {
        merged[pid] = { ...agg };
        continue;
      }
      const prev    = merged[pid];
      const totalGp = prev.gp + agg.gp;
      const wavg    = (a, b) =>
        totalGp > 0 ? +((a * prev.gp + b * agg.gp) / totalGp).toFixed(2) : 0;
      merged[pid] = {
        ...prev,
        gp:         totalGp,
        ptsAvg:     wavg(prev.ptsAvg,     agg.ptsAvg),
        rebAvg:     wavg(prev.rebAvg,     agg.rebAvg),
        orbAvg:     wavg(prev.orbAvg,     agg.orbAvg),
        drbAvg:     wavg(prev.drbAvg,     agg.drbAvg),
        astAvg:     wavg(prev.astAvg,     agg.astAvg),
        stlAvg:     wavg(prev.stlAvg,     agg.stlAvg),
        blkAvg:     wavg(prev.blkAvg,     agg.blkAvg),
        toAvg:      wavg(prev.toAvg,      agg.toAvg),
        pfAvg:      wavg(prev.pfAvg,      agg.pfAvg),
        minutesAvg: wavg(prev.minutesAvg, agg.minutesAvg),
        effAvg:     wavg(prev.effAvg,     agg.effAvg),
        tsPct:      wavg(prev.tsPct,      agg.tsPct),
        // Shot totals summed so percentages can be recomputed accurately
        fgmTotal:   prev.fgmTotal  + agg.fgmTotal,
        fgaTotal:   prev.fgaTotal  + agg.fgaTotal,
        fg2mTotal:  prev.fg2mTotal + agg.fg2mTotal,
        fg2aTotal:  prev.fg2aTotal + agg.fg2aTotal,
        fg3mTotal:  prev.fg3mTotal + agg.fg3mTotal,
        fg3aTotal:  prev.fg3aTotal + agg.fg3aTotal,
        ftmTotal:   prev.ftmTotal  + agg.ftmTotal,
        ftaTotal:   prev.ftaTotal  + agg.ftaTotal,
      };
    }

    const pct = (m, a) => a > 0 ? +((m / a) * 100).toFixed(1) : 0;

    const statsMap = {};
    for (const [pid, agg] of Object.entries(merged)) {
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
        // Percentages from raw totals — accurate across leagues
        fgPct:  pct(agg.fgmTotal,  agg.fgaTotal),
        fg2Pct: pct(agg.fg2mTotal, agg.fg2aTotal),
        fg3Pct: pct(agg.fg3mTotal, agg.fg3aTotal),  // tpPct (DB) → fg3Pct (app)
        ftPct:  agg.ftaTotal > 0 ? pct(agg.ftmTotal, agg.ftaTotal) : null,
        tsPct:  +agg.tsPct.toFixed(1),
        eff:    +agg.effAvg.toFixed(1),  // named eff to match public convention
        gp:     agg.gp,
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
      sourceUrl:      g.sourceUrl ?? null,
      youtubeUrl:     g.youtubeUrl ?? null,
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
    });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);