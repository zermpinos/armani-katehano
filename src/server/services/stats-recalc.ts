import "@/server/_internal/node-only";
import { randomUUID } from "node:crypto";
import prisma          from "@/server/db/client";
import { Prisma }      from "../../../lib/generated/prisma/client";
import { calcEff }     from "@/domain/stats";

function calcTsPct(pts: number, fga: number, fta: number) {
  const denom = 2 * (fga + 0.44 * fta);
  return denom > 0 ? +((pts / denom) * 100).toFixed(1) : 0;
}

function pct(made: number, attempted: number) {
  return attempted > 0 ? +((made / attempted) * 100).toFixed(1) : 0;
}

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

  const toUpsert: any[] = [];
  const toDelete: string[] = [];

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

  // P-01: one deleteMany for all 0-minute players (was 1 call per player)
  if (toDelete.length > 0) {
    await tx.playerSeasonAggregate.deleteMany({
      where: { seasonLeagueId, playerId: { in: toDelete } },
    });
  }

  if (toUpsert.length === 0) return;

  // P-01: single bulk upsert via raw SQL (was N sequential awaits)
  // All values are passed as bound parameters -- no string interpolation of data.
  // Column order must match exactly between INSERT cols list and row value push.
  const cols = [
    "id",
    "playerId",    "seasonLeagueId", "gp",
    "ptsAvg",      "rebAvg",         "orbAvg",    "drbAvg",    "astAvg",
    "stlAvg",      "blkAvg",         "toAvg",     "pfAvg",     "minutesAvg",
    "fgPct",       "fg2Pct",         "fg3Pct",    "ftPct",     "tsPct",
    "ptsTotal",    "rebTotal",       "astTotal",  "stlTotal",
    "fgmTotal",    "fgaTotal",
    "fg2mTotal",   "fg2aTotal",
    "fg3mTotal",   "fg3aTotal",
    "ftmTotal",    "ftaTotal",
    "effAvg",
    "updatedAt",
  ];

  // Guard: every col must also exist as a key on the first toUpsert row.
  if (toUpsert.length > 0) {
    const sample = toUpsert[0];
    for (const col of cols) {
      if (!(col in sample)) {
        throw new Error(`recalcAggregates: col "${col}" is not set on the upsert row -- check for a typo or missed rename`);
      }
    }
  }

  const colList = Prisma.join(cols.map(c => Prisma.raw(`"${c}"`)));

  const valuePlaceholders = Prisma.join(
    toUpsert.map((row: any) =>
      // eslint-disable-next-line security/detect-object-injection
      Prisma.sql`(${Prisma.join(cols.map(col => row[col]))})`
    )
  );

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
