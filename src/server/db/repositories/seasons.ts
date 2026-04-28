import "@/server/_internal/node-only";
import prisma from "@/server/db/client";

export async function getSeasons() {
  const seasons = await prisma.season.findMany({
    orderBy: { year: "asc" },
  });
  return seasons.map(s => s.name);
}
