/**
 * lib/stats.prisma.js
 * Server-side aggregate recalculation.
 * Called after every game create/update/delete.
 * Never called from the frontend.
 *
 * Accepts an optional Prisma transaction client (tx).
 * Always pass tx when calling from inside a $transaction block.
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
 *
 * @param {string} seasonLeagueId
 * @param {object} [tx] - Prisma transaction client. Defaults to global prisma.
 */
export async function recalcAggregates(seasonLeagueId, tx = prisma) {
  const games = await tx.game.findMany({
    where:   { seasonLeagueId },
    include: { playerStats: true },
  });

  const allStats  = games.flatMap(g => g.playerStats);
  const playerIds = [...new Set(allStats.map(r => r.playerId))];

  for (const playerId of playerIds) {
    const rows = allStats.filter(r => r.playerId === playerId && r.minutes > 0);
    const gp   = rows.length;

    if (gp === 0) {
      await tx.playerSeasonAggregate.deleteMany({
        where: { playerId, seasonLeagueId },
      });
      continue;
    }

    const sum = key => rows.reduce((a, r) => a + (r[key] || 0), 0);
    const avg = key => +(sum(key) / gp).toFixed(2);

    const totalPts  = sum("pts");
    const totalFga  = sum("fga");
    const totalFta  = sum("fta");
    const totalFgm  = sum("fgm");
    const totalFg3m = sum("fg3m");   // ← was tpm
    const totalFg3a = sum("fg3a");   // ← was tpa
    const totalFtm  = sum("ftm");
    const totalReb  = sum("reb");
    const totalAst  = sum("ast");

    // 2-point FG: now stored explicitly, but also derivable
    const totalFg2m = sum("fg2m");
    const totalFg2a = sum("fg2a");

    const aggregateData = {
      gp,
      ptsAvg:     avg("pts"),
      rebAvg:     avg("reb"),
      orbAvg:     avg("orb"),
      drbAvg:     avg("drb"),
      astAvg:     avg("ast"),
      stlAvg:     avg("stl"),
      blkAvg:     avg("blk"),
      toAvg:      avg("tov"),         // ← was avg("to")
      pfAvg:      avg("pf"),
      minutesAvg: avg("minutes"),
      fgPct:      pct(totalFgm,  totalFga),
      fg2Pct:     pct(totalFg2m, totalFg2a),
      tpPct:      pct(totalFg3m, totalFg3a),  // ← was tpm/tpa
      ftPct:      pct(totalFtm,  totalFta),
      tsPct:      calcTsPct(totalPts, totalFga, totalFta),
      ptsTotal:   totalPts,
      rebTotal:   totalReb,
      astTotal:   totalAst,
    };

    await tx.playerSeasonAggregate.upsert({
      where:  { playerId_seasonLeagueId: { playerId, seasonLeagueId } },
      update: aggregateData,
      create: { playerId, seasonLeagueId, ...aggregateData },
    });
  }
}
