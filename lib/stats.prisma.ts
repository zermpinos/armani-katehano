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
 *       INSERT ... ON CONFLICT ... DO UPDATE. For a 13-player roster this
 *       reduces sequential DB round-trips from 13+ down to 2:
 *         1. deleteMany  -- removes 0-minute players (batch)
 *         2. $executeRawUnsafe -- upserts all active players (batch)
 *
 * Q-05: calcEff() from lib/stats.js is the single source of truth for EFF.
 */
import { randomUUID } from "crypto";
import prisma          from "./prisma";
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
export async function recalcAggregates(seasonLeagueId: string, tx: any = prisma) {
  const games = await tx.game.findMany({
    where:   { seasonLeagueId },
    include: { playerStats: true },
  });

  const allStats  = games.flatMap((g: any) => g.playerStats);
  const playerIds = [...new Set(allStats.map((r: any) => r.playerId))] as string[];

  // ── Single pass: compute aggregates for all players ──────────────────────
  const toUpsert: any[] = [];  // players with gp > 0
  const toDelete: string[] = [];  // players with only 0-minute rows -- remove their aggregates

  for (const playerId of playerIds) {
    const rows = allStats.filter((r: any) => r.playerId === playerId && r.minutes > 0);
    const gp   = rows.length;

    if (gp === 0) {
      toDelete.push(playerId);
      continue;
    }

    const sum = (key: string) => rows.reduce((a: number, r: any) => a + ((r as any)[key] || 0), 0);
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

    const effAvg = +(rows.reduce((a: number, r: any) => a + calcEff(r), 0) / gp).toFixed(2);

    toUpsert.push({
      id: randomUUID(),
      playerId,
      seasonLeagueId,
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
      tpPct:     pct(totalFg3m, totalFg3a),  // DB column name; app layer exposes this as fg3Pct
      ftPct:     pct(totalFtm,  totalFta),
      tsPct:     calcTsPct(totalPts, totalFga, totalFta),
      ptsTotal:  totalPts,
      rebTotal:  totalReb,
      astTotal:  totalAst,
      fgmTotal:  totalFgm,
      fgaTotal:  totalFga,
      fg2mTotal: totalFg2m,
      fg2aTotal: totalFg2a,
      fg3mTotal: totalFg3m,
      fg3aTotal: totalFg3a,
      ftmTotal:  totalFtm,
      ftaTotal:  totalFta,
      effAvg,
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
  // All values are passed as bound parameters -- no string interpolation of data.
  // Column order must match exactly between INSERT cols list and row value push.
  // These must exactly match the PlayerSeasonAggregate column names in schema.prisma.
  // If you rename a column there, rename it here too -- mismatches throw at runtime.
  const cols = [
    "id",
    "playerId",    "seasonLeagueId", "gp",
    "ptsAvg",      "rebAvg",         "orbAvg",    "drbAvg",    "astAvg",
    "stlAvg",      "blkAvg",         "toAvg",     "pfAvg",     "minutesAvg",
    "fgPct",       "fg2Pct",         "tpPct",     "ftPct",     "tsPct",
    "ptsTotal",    "rebTotal",       "astTotal",
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
        throw new Error(`recalcAggregates: col "${col}" is not set on the upsert row -- check for a typo or missed rename`);
      }
    }
  }

  const params: any[] = [];
  const rowsSql = toUpsert.map((row: any) => {
    const start = params.length + 1;
    cols.forEach(col => params.push(row[col]));
    const placeholders = cols.map((_, i) => `$${start + i}`).join(", ");
    return `(${placeholders})`;
  });

  // Update every column on conflict except the composite primary key
  const updateCols = cols
    .filter(c => c !== "id" && c !== "playerId" && c !== "seasonLeagueId")
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(", ");

  await tx.$executeRawUnsafe(`
    INSERT INTO "PlayerSeasonAggregate" (${cols.map(c => `"${c}"`).join(", ")})
    VALUES ${rowsSql.join(", ")}
    ON CONFLICT ("playerId", "seasonLeagueId")
    DO UPDATE SET ${updateCols}
  `, ...params);
}