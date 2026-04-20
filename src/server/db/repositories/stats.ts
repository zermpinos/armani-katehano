import prisma from "@/server/db/client";
import { aggregatesToStatsMap } from "@/domain/stats";

export async function getStats(seasonName: string, leagueSlug: string | null = null) {
  const aggregates = await prisma.playerSeasonAggregate.findMany({
    where: {
      seasonLeague: {
        season: { name: seasonName },
        ...(leagueSlug ? { league: { slug: leagueSlug } } : {}),
      },
    },
    include: { player: true },
  });

  return aggregatesToStatsMap(aggregates);
}

export async function getAllSeasonsStats(seasons: string[]) {
  if (seasons.length === 0) return {};

  // Single query for all seasons — avoids N separate DB round-trips.
  const allAggregates = await prisma.playerSeasonAggregate.findMany({
    where: { seasonLeague: { season: { name: { in: seasons } } } },
    include: {
      player:       true,
      seasonLeague: { include: { season: true } },
    },
  });

  // Group rows by season name, then process each group with the shared helper.
  const bySeason: Record<string, any[]> = Object.fromEntries(seasons.map((s: string) => [s, []]));
  for (const agg of allAggregates) {
    const name = agg.seasonLeague.season.name;
    // eslint-disable-next-line security/detect-object-injection
    if (Object.hasOwn(bySeason, name)) bySeason[name].push(agg);
  }

  return Object.fromEntries(
    // eslint-disable-next-line security/detect-object-injection
    seasons.map((s: string) => [s, aggregatesToStatsMap(bySeason[s])])
  );
}
