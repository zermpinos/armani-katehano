// @ts-nocheck
import { vi, describe, it, expect, afterEach } from "vitest";

vi.mock("@/server/db/client", () => ({
  default: { $connect: vi.fn() },
  prisma:  { $connect: vi.fn() },
}));

vi.mock("@/server/db/repositories", () => {
  const down = () => vi.fn().mockRejectedValue(new Error("db down"));
  return {
    getAllPublicData:                  down(),
    getAllGames:                       down(),
    getGames:                          down(),
    getSeasons:                        down(),
    getConfig:                         down(),
    getAllUpcomingGames:               down(),
    getAllSeasonsStats:                down(),
    getRosterBySeason:                 down(),
    getAllPlayerGameLogs:              down(),
    getUpcomingGamesWithAnnouncements: down(),
    getNextPlayoffGame:                down(),
    getArchivedSeasonNames:            down(),
    getAwardsForArchivedSeasons:       down(),
  };
});

const PAGES = [
  ["/",            () => import("../../../../pages/index")],
  ["/games",       () => import("../../../../pages/games")],
  ["/players",     () => import("../../../../pages/players")],
  ["/leaderboard", () => import("../../../../pages/leaderboard")],
  ["/team-stats",  () => import("../../../../pages/team-stats")],
  ["/records",     () => import("../../../../pages/records")],
];

describe("static public pages: a database error", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(PAGES)("%s throws at runtime, so Next keeps the last good page", async (_path, load) => {
    const { getStaticProps } = await load();
    await expect(getStaticProps()).rejects.toThrow("db down");
  });

  it.each(PAGES)("%s still builds empty when the build has no database", async (_path, load) => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const { getStaticProps } = await load();
    expect(await getStaticProps()).toMatchObject({ revalidate: 60 });
  });
});
