import "@/server/_internal/node-only";
import prisma from "@/server/db/client";

export type SeasonPhase = "regular" | "quarterfinal" | "semifinal" | "final";

export async function getConfig() {
  const seasonWithGames = await prisma.season.findFirst({
    where: { seasonLeagues: { some: { games: { some: {} } } } },
    orderBy: { year: "desc" },
  });
  const season = seasonWithGames ?? await prisma.season.findFirst({
    orderBy: { year: "desc" },
  });

  const [phaseSetting, popupEnabledSetting, popupVersionSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "seasonPhase" } }),
    prisma.setting.findUnique({ where: { key: "popupEnabled" } }),
    prisma.setting.findUnique({ where: { key: "popupVersion" } }),
  ]);

  return {
    currentSeason:  season?.name ?? "2025-26",
    seasonPhase:    (phaseSetting?.value ?? "regular") as SeasonPhase,
    popupEnabled:   popupEnabledSetting?.value === "true",
    popupVersion:   parseInt(popupVersionSetting?.value ?? "1", 10),
  };
}
