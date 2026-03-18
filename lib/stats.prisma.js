/**
 * lib/stats.prisma.js
 * Server-side aggregate recalculation.
 * Called after every game create/update/delete.
 * Never called from the frontend.
 */

import prisma from "./prisma.js";

function calcTsPct(pts, fga, fta) {
  const denom = 2 * (fga + 0.44 * fta);
  return denom > 0 ? +((pts / denom) * 100).toFixed(1) : 0;
}

function pct(made, attempted) {
  return attempted > 0 ? +((made / attempted) * 100).toFixed(1) : 0;
}

/**
 * Recomputes PlayerSeasonAggregate for every player
 * in a given SeasonLeague. Called after any game mutation.
 */
export async function recalcAggregates(seasonLeagueId) {
  // Get all games for this SeasonLeague with their stats
  const games = await prisma.game.findMany({
    where: { seasonLeagueId },
    include: { playerStats: true },
  });

  // Get all players who have at least one stat row in this SeasonLeague
  const allStats = games.flatMap(g => g.playerStats);
  const playerIds = [...new Set(allStats.map(r => r.playerId))];

  for (const playerId of playerIds) {
    const rows = allStats.filter(r => r.playerId === playerId && r.minutes > 0);
    const gp = rows.length;

    if (gp === 0) {
      // Delete aggregate if player has no minutes
      await prisma.playerSeasonAggregate.deleteMany({
        where: { playerId, seasonLeagueId },
      });
      continue;
    }

    const sum = key => rows.reduce((a, r) => a + (r[key] || 0), 0);
    const avg = key => +(sum(key) / gp).toFixed(2);

    const totalPts = sum("pts");
    const totalFga = sum("fga");
    const totalFta = sum("fta");
    const totalFgm = sum("fgm");
    const totalTpm = sum("tpm");
    const totalTpa = sum("tpa");
    const totalFtm = sum("ftm");
    const totalReb = sum("reb");
    const totalAst = sum("ast");

    await prisma.playerSeasonAggregate.upsert({
      where: { playerId_seasonLeagueId: { playerId, seasonLeagueId } },
      update: {
        gp,
        ptsAvg:     avg("pts"),
        rebAvg:     avg("reb"),
        astAvg:     avg("ast"),
        stlAvg:     avg("stl"),
        blkAvg:     avg("blk"),
        toAvg:      avg("to"),
        pfAvg:      avg("pf"),
        minutesAvg: avg("minutes"),
        fgPct:      pct(totalFgm, totalFga),
        tpPct:      pct(totalTpm, totalTpa),
        ftPct:      pct(totalFtm, totalFta),
        tsPct:      calcTsPct(totalPts, totalFga, totalFta),
        ptsTotal:   totalPts,
        rebTotal:   totalReb,
        astTotal:   totalAst,
      },
      create: {
        playerId,
        seasonLeagueId,
        gp,
        ptsAvg:     avg("pts"),
        rebAvg:     avg("reb"),
        astAvg:     avg("ast"),
        stlAvg:     avg("stl"),
        blkAvg:     avg("blk"),
        toAvg:      avg("to"),
        pfAvg:      avg("pf"),
        minutesAvg: avg("minutes"),
        fgPct:      pct(totalFgm, totalFga),
        tpPct:      pct(totalTpm, totalTpa),
        ftPct:      pct(totalFtm, totalFta),
        tsPct:      calcTsPct(totalPts, totalFga, totalFta),
        ptsTotal:   totalPts,
        rebTotal:   totalReb,
        astTotal:   totalAst,
      },
    });
  }
}
