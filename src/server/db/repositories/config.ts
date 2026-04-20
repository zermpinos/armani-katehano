import prisma from "@/server/db/client";

export async function getConfig() {
  // Prefer the most recent season that has at least one game — avoids a
  // future empty season being picked as "current" before any games are added.
  const seasonWithGames = await prisma.season.findFirst({
    where: { seasonLeagues: { some: { games: { some: {} } } } },
    orderBy: { year: "desc" },
  });
  const season = seasonWithGames ?? await prisma.season.findFirst({
    orderBy: { year: "desc" },
  });
  return { currentSeason: season?.name ?? "2025-26" };
}
