import "@/server/_internal/node-only";
import prisma from "@/server/db/client";
import { computeAwards, type AggregateInput, type Awards } from "@/domain/awards";

export async function getAwardsForArchivedSeasons(): Promise<Record<string, Awards | null>> {
  const archivedSeasons = await prisma.season.findMany({
    where: { archivedAt: { not: null } },
    select: {
      name: true,
      seasonLeagues: {
        select: {
          _count: { select: { games: true } },
          seasonAggregates: {
            select: {
              gp: true,
              ptsTotal: true,
              rebTotal: true,
              astTotal: true,
              effAvg: true,
              tsPct: true,
              fgaTotal: true,
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
      (n, sl) => n + sl._count.games,
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
