// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-admin-integration";
});

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    season:       { findFirst: vi.fn() },
    seasonLeague: { findMany: vi.fn() },
    game:         { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    player:       { findMany: vi.fn() },
    auditLog:     { create: vi.fn().mockResolvedValue(undefined) },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));

import handler from "../../../../pages/api/admin/data";
import { mockRes, mockReq, authedReq, VALID_CUID, VALID_SEASON_LEAGUE } from "./__support__/games-admin-mocks";

const SEASON = { id: "clseason2026xxxxxxxxxxxx", name: "2026-27", year: 2026 };
const SL = {
  id: VALID_SEASON_LEAGUE, seasonId: SEASON.id,
  league: { name: "Super League", slug: "men" }, season: { name: "2026-27" },
};
const GAME = {
  id: VALID_CUID, seasonLeagueId: VALID_SEASON_LEAGUE, playedOn: new Date("2026-04-12T19:30:00.000Z"),
  opponent: "Rivals", location: "away", result: "W", teamScore: 70, opponentScore: 60, round: "semifinal",
  notes: "Played at the old gym", sourceUrl: "https://example.com/g/1", youtubeUrl: null,
  seasonLeague: { seasonId: SEASON.id },
  playerStats: [{
    playerId: "p1", played: true, minutes: 24, pts: 12, reb: 5, orb: 2, drb: 3, ast: 4, stl: 1, blk: 0, tov: 2, pf: 3,
    fgm: 5, fga: 9, fg2m: 4, fg2a: 6, fg3m: 1, fg3a: 3, ftm: 1, fta: 2,
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.season.findFirst.mockResolvedValue(SEASON);
  mockPrisma.seasonLeague.findMany.mockResolvedValue([SL]);
  mockPrisma.game.findMany.mockResolvedValue([GAME]);
  mockPrisma.game.count.mockResolvedValue(40);
  mockPrisma.game.findUnique.mockResolvedValue(GAME);
  mockPrisma.player.findMany.mockResolvedValue([{ id: "p1", name: "Anna Alpha", number: 4, position: "PG", isActive: true }]);
});

const get = async (query = {}) => {
  const res = mockRes();
  await handler(authedReq({ method: "GET", query }), res);
  return res;
};

describe("GET /api/admin/data", () => {
  it("answers 401 without a session", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(401);
  });

  it("answers 405 to anything but GET", async () => {
    const res = mockRes();
    await handler(authedReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
  });

  it("rejects a gameId that is neither a cuid nor new", async () => {
    expect((await get({ gameId: "../etc" })).statusCode).toBe(400);
  });

  it("lists the current season's games with their round, and counts the older ones", async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.seasonLeague.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { seasonId: SEASON.id } }));
    expect(mockPrisma.game.count).toHaveBeenCalledWith({ where: { seasonLeagueId: { notIn: [VALID_SEASON_LEAGUE] } } });
    expect(res._body.currentSeason).toBe("2026-27");
    expect(res._body.olderCount).toBe(40);
    expect(res._body.games[0]).toEqual({
      id: VALID_CUID, seasonLeagueId: VALID_SEASON_LEAGUE, date: "2026-04-12", opponent: "Rivals", home: false,
      result: "W", teamScore: 70, opponentScore: 60, round: "semifinal",
    });
    expect(res._body.seasonLeagues).toEqual([
      { id: VALID_SEASON_LEAGUE, leagueName: "Super League", leagueSlug: "men", seasonName: "2026-27" },
    ]);
  });

  it("sends no box scores, players or stats with the list", async () => {
    const res = await get();
    expect(Object.keys(res._body).sort()).toEqual(["currentSeason", "games", "olderCount", "seasonLeagues"]);
    expect(mockPrisma.player.findMany).not.toHaveBeenCalled();
  });

  it("lists every season with all=1", async () => {
    const res = await get({ all: "1" });
    expect(mockPrisma.season.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.seasonLeague.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(mockPrisma.game.count).not.toHaveBeenCalled();
    expect(res._body.olderCount).toBe(0);
  });

  it("returns an empty list when no season exists yet", async () => {
    mockPrisma.season.findFirst.mockResolvedValue(null);
    const res = await get();
    expect(res._body).toEqual({ currentSeason: null, games: [], seasonLeagues: [], olderCount: 0 });
    expect(mockPrisma.game.findMany).not.toHaveBeenCalled();
  });

  it("returns one game with its round, notes and box score, and the leagues of its own season", async () => {
    const res = await get({ gameId: VALID_CUID });
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.game.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: VALID_CUID } }));
    expect(mockPrisma.seasonLeague.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { seasonId: SEASON.id } }));
    expect(res._body.game.round).toBe("semifinal");
    expect(res._body.game.notes).toBe("Played at the old gym");
    expect(res._body.game.boxScore[0]).toMatchObject({ playerId: "p1", minutes: 24, pts: 12, fg2m: 4, fg3m: 1 });
    expect(res._body.players).toHaveLength(1);
  });

  it("answers 404 for an unknown game", async () => {
    mockPrisma.game.findUnique.mockResolvedValue(null);
    expect((await get({ gameId: VALID_CUID })).statusCode).toBe(404);
  });

  it("gives the empty form the current season's leagues and every player", async () => {
    const res = await get({ gameId: "new" });
    expect(res.statusCode).toBe(200);
    expect(res._body.game).toBeNull();
    expect(mockPrisma.seasonLeague.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { seasonId: SEASON.id } }));
    expect(res._body.players).toHaveLength(1);
  });

  it("reads every player, inactive ones included, in both edit modes", async () => {
    await get({ gameId: VALID_CUID });
    await get({ gameId: "new" });
    expect(mockPrisma.player.findMany).toHaveBeenCalledTimes(2);
    for (const [arg] of mockPrisma.player.findMany.mock.calls) expect(arg).not.toHaveProperty("where");
  });
});
