// @ts-nocheck
import { vi, describe, it, expect } from "vitest";

vi.mock("@/server/db/client", () => ({
  default: { $connect: vi.fn() },
  prisma:  { $connect: vi.fn() },
}));

const MOCK_PUBLIC_DATA = {
  config:               { currentSeason: "2025-26", seasonPhase: "regular", popupEnabled: false, popupVersion: 1, popupRound: null },
  seasons:              ["2025-26"],
  currentSeason:        "2025-26",
  players:              [],
  games:                [],
  stats:                {},
  upcomingGames:        [],
  archivedSeasonNames:  [],
  awardsBySeasonName:   {},
};

vi.mock("@/server/db/repositories", () => ({
  getAllPublicData:                   vi.fn().mockResolvedValue(MOCK_PUBLIC_DATA),
  getAllGames:                        vi.fn().mockResolvedValue([]),
  getGames:                           vi.fn().mockResolvedValue([]),
  getSeasons:                         vi.fn().mockResolvedValue(["2025-26"]),
  getConfig:                          vi.fn().mockResolvedValue(MOCK_PUBLIC_DATA.config),
  getAllUpcomingGames:                vi.fn().mockResolvedValue([]),
  getAllSeasonsStats:                 vi.fn().mockResolvedValue({}),
  getAllPlayerGameLogs:               vi.fn().mockResolvedValue({}),
  getUpcomingGamesWithAnnouncements:  vi.fn().mockResolvedValue([]),
  getNextPlayoffGame:                 vi.fn().mockResolvedValue(null),
  getArchivedSeasonNames:             vi.fn().mockResolvedValue([]),
  getAwardsForArchivedSeasons:        vi.fn().mockResolvedValue({}),
}));

vi.mock("@/domain/stats", () => ({ buildAllTimeStatsMap: vi.fn().mockReturnValue({}) }));

describe("static public pages — getStaticProps revalidate values", () => {
  it("/games returns revalidate: 3600", async () => {
    const { getStaticProps } = await import("../../../../pages/games");
    const result = await getStaticProps();
    expect(result).toMatchObject({ revalidate: 3600 });
  });

  it("/players returns revalidate: 3600", async () => {
    const { getStaticProps } = await import("../../../../pages/players");
    const result = await getStaticProps();
    expect(result).toMatchObject({ revalidate: 3600 });
  });

  it("/leaderboard returns revalidate: 3600", async () => {
    const { getStaticProps } = await import("../../../../pages/leaderboard");
    const result = await getStaticProps();
    expect(result).toMatchObject({ revalidate: 3600 });
  });

  it("/team-stats returns revalidate: 3600", async () => {
    const { getStaticProps } = await import("../../../../pages/team-stats");
    const result = await getStaticProps();
    expect(result).toMatchObject({ revalidate: 3600 });
  });

  it("/ (home) returns revalidate: 3600", async () => {
    const { getStaticProps } = await import("../../../../pages/index");
    const result = await getStaticProps();
    expect(result).toMatchObject({ revalidate: 3600 });
  });
});
