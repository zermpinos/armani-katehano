/**
 * lib/stats.prisma.js
 * Server-side aggregate recalculation.
 * Called after every game create/update/delete.
 * Never called from the frontend.
 *
 * Accepts an optional Prisma transaction client (tx).
 * Always pass tx when calling from inside a $transaction block.
 *
 * P-01: The original N+1 sequential upsert loop (1 DB round-trip per player)
 *       has been replaced with a single batched raw SQL
 *       INSERT … ON CONFLICT … DO UPDATE. For a 13-player roster this
 *       reduces sequential DB round-trips from 13+ down to 2:
 *         1. deleteMany  — removes 0-minute players (batch)
 *         2. $executeRawUnsafe — upserts all active players (batch)
 *
 * Q-05: calcEff() from lib/stats.js is the single source of truth for EFF.
 */
import { randomUUID } from "crypto";
import prisma          from "./prisma";
import { Prisma }      from "./generated/prisma/client";
import { calcEff }     from "./stats";

function calcTsPct(pts: number, fga: number, fta: number) {
  const denom = 2 * (fga + 0.44 * fta);
  return denom > 0 ? +((pts / denom) * 100).toFixed(1) : 0;
}

function pct(made: number, attempted: number) {
  return attempted > 0 ? +((made / attempted) * 100).toFixed(1) : 0;
}

/**
 * Recomputes PlayerSeasonAggregate for every player
 * in a given SeasonLeague. Called after any game mutation.
 *
 * @param {string} seasonLeagueId
 * @param {object} [tx] - Prisma transaction client. Defaults to global prisma.
 */
/**
 * Pure aggregate computation for a single player's box-score rows.
 * Rows may include DNPs (minutes === 0); those are excluded from gp and all averages.
 * Returns null when the player has no active games.
 */
export function computePlayerAggregates(rows: any[]): Record<string, any> | null {
  const active = rows.filter((r: any) => r.minutes > 0);
  const gp = active.length;
  if (gp === 0) return null;

  // eslint-disable-next-line security/detect-object-injection
  const sum = (key: string) => active.reduce((a: number, r: any) => a + ((r as any)[key] || 0), 0);
  const avg = (key: string) => +(sum(key) / gp).toFixed(2);

  const totalPts  = sum("pts");
  const totalFgm  = sum("fgm");
  const totalFga  = sum("fga");
  const totalFg2m = sum("fg2m");
  const totalFg2a = sum("fg2a");
  const totalFg3m = sum("fg3m");
  const totalFg3a = sum("fg3a");
  const totalFtm  = sum("ftm");
  const totalFta  = sum("fta");
  const totalReb  = sum("reb");
  const totalAst  = sum("ast");
  const totalStl  = sum("stl");

  const effAvg = +(active.reduce((a: number, r: any) => a + calcEff(r), 0) / gp).toFixed(2);

  return {
    gp,
    ptsAvg:    avg("pts"),
    rebAvg:    avg("reb"),
    orbAvg:    avg("orb"),
    drbAvg:    avg("drb"),
    astAvg:    avg("ast"),
    stlAvg:    avg("stl"),
    blkAvg:    avg("blk"),
    toAvg:     avg("tov"),
    pfAvg:     avg("pf"),
    minutesAvg: avg("minutes"),
    fgPct:     pct(totalFgm,  totalFga),
    fg2Pct:    pct(totalFg2m, totalFg2a),
    fg3Pct:    pct(totalFg3m, totalFg3a),
    ftPct:     pct(totalFtm,  totalFta),
    tsPct:     calcTsPct(totalPts, totalFga, totalFta),
    ptsTotal:  totalPts,
    rebTotal:  totalReb,
    astTotal:  totalAst,
    stlTotal:  totalStl,
    fgmTotal:  totalFgm,
    fgaTotal:  totalFga,
    fg2mTotal: totalFg2m,
    fg2aTotal: totalFg2a,
    fg3mTotal: totalFg3m,
    fg3aTotal: totalFg3a,
    ftmTotal:  totalFtm,
    ftaTotal:  totalFta,
    effAvg,
  };
}

export async function recalcAggregates(seasonLeagueId: string, tx: any = prisma) {
  const games = await tx.game.findMany({
    where:   { seasonLeagueId },
    include: { playerStats: true },
  });

  const allStats  = games.flatMap((g: any) => g.playerStats);
  const playerIds = [...new Set(allStats.map((r: any) => r.playerId))] as string[];

  // ── Single pass: compute aggregates for all players ──────────────────────
  const toUpsert: any[] = [];  // players with gp > 0
  const toDelete: string[] = [];  // players with only 0-minute rows — remove their aggregates

  for (const playerId of playerIds) {
    const playerRows = allStats.filter((r: any) => r.playerId === playerId);
    const agg = computePlayerAggregates(playerRows);

    if (agg === null) {
      toDelete.push(playerId);
      continue;
    }

    toUpsert.push({
      id: randomUUID(),
      playerId,
      seasonLeagueId,
      ...agg,
      updatedAt: new Date(),
    });
  }

  // ── P-01: one deleteMany for all 0-minute players (was 1 call per player) ─
  if (toDelete.length > 0) {
    await tx.playerSeasonAggregate.deleteMany({
      where: { seasonLeagueId, playerId: { in: toDelete } },
    });
  }

  if (toUpsert.length === 0) return;

  // ── P-01: single bulk upsert via raw SQL (was N sequential awaits) ────────
  // All values are passed as bound parameters — no string interpolation of data.
  // Column order must match exactly between INSERT cols list and row value push.
  // These must exactly match the PlayerSeasonAggregate column names in schema.prisma.
  // If you rename a column there, rename it here too — mismatches throw at runtime.
  const cols = [
    "id",
    "playerId",    "seasonLeagueId", "gp",
    "ptsAvg",      "rebAvg",         "orbAvg",    "drbAvg",    "astAvg",
    "stlAvg",      "blkAvg",         "toAvg",     "pfAvg",     "minutesAvg",
    "fgPct",       "fg2Pct",         "fg3Pct",    "ftPct",     "tsPct",
    "ptsTotal",    "rebTotal",       "astTotal",    "stlTotal",
    "fgmTotal",    "fgaTotal",
    "fg2mTotal",   "fg2aTotal",
    "fg3mTotal",   "fg3aTotal",
    "ftmTotal",    "ftaTotal",
    "effAvg",
    "updatedAt",
  ];

  // Guard: every col must also exist as a key on the first toUpsert row.
  // Catches typos and forgotten renames before hitting the DB.
  if (toUpsert.length > 0) {
    const sample = toUpsert[0];
    for (const col of cols) {
      if (!(col in sample)) {
        throw new Error(`recalcAggregates: col "${col}" is not set on the upsert row — check for a typo or missed rename`);
      }
    }
  }

  // Column list: all identifiers are hardcoded constants — safe to use Prisma.raw()
  const colList = Prisma.join(cols.map(c => Prisma.raw(`"${c}"`)));

  // Value rows: each data value is safely parameterised by Prisma.sql / Prisma.join
  const valuePlaceholders = Prisma.join(
    toUpsert.map((row: any) =>
      // eslint-disable-next-line security/detect-object-injection
      Prisma.sql`(${Prisma.join(cols.map(col => row[col]))})`
    )
  );

  // Update set: column names are hardcoded constants — safe to use Prisma.raw()
  const updateSet = Prisma.join(
    cols
      .filter(c => c !== "id" && c !== "playerId" && c !== "seasonLeagueId")
      .map(c => Prisma.raw(`"${c}" = EXCLUDED."${c}"`))
  );

  await tx.$executeRaw`
    INSERT INTO "PlayerSeasonAggregate" (${colList})
    VALUES ${valuePlaceholders}
    ON CONFLICT ("playerId", "seasonLeagueId")
    DO UPDATE SET ${updateSet}
  `;
}