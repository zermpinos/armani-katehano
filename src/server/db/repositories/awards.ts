import "@/server/_internal/node-only";
import prisma from "@/server/db/client";
import { computeAwards, type AggregateInput, type Awards } from "@/domain/awards";

/**
 * Compute awards for every archived Season.
 * Returns `{ [seasonName]: Awards | null }`. Non-archived seasons are omitted.
 */
export async function getAwardsForArchivedSeasons(): Promise<Record<string, Awards | null>> {
  const archivedSeasons = await prisma.season.findMany({
    where: { archivedAt: { not: null } },
    include: {
      seasonLeagues: {
        include: {
          games: { select: { id: true } },
          seasonAggregates: {
            include: {
              player: { select: { id: true, name: true, slug: true, number: true } },
            },
          },
        },
      },
    },
  });

  const out: Record<string, Awards | null> = {};
  for (const season of archivedSeasons) {
    const totalGames = season.seasonLeagues.reduce(
      (n, sl) => n + sl.games.length,
      0
    );
    const rows: AggregateInput[] = season.seasonLeagues.flatMap((sl) =>
      sl.seasonAggregates.map((a) => ({
        playerId: a.player.id,
        playerName: a.player.name,
        playerSlug: a.player.slug,
        playerNumber: a.player.number,
        gp: a.gp,
        ptsTotal: a.ptsTotal,
        rebTotal: a.rebTotal,
        astTotal: a.astTotal,
        effAvg: a.effAvg,
        tsPct: a.tsPct,
        fgaTotal: a.fgaTotal,
      }))
    );
    out[season.name] = computeAwards(rows, totalGames);
  }
  return out;
}

export async function getArchivedSeasonNames(): Promise<string[]> {
  const seasons = await prisma.season.findMany({
    where: { archivedAt: { not: null } },
    select: { name: true },
  });
  return seasons.map((s) => s.name);
}
