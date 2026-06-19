// @ts-nocheck
import { vi } from "vitest";
import { signSession, SESSION_TTL_S } from "@/server/auth";

export const VALID_CUID         = "clxxxxxxxxxxxxxxxxxxxxxx";
export const VALID_SEASON_LEAGUE = "clseasonxxxxxxxxxxxxxxxx";

export const MOCK_GAME = {
  id:             "clgamexxxxxxxxxxxxxxxxxx",
  seasonLeagueId: VALID_SEASON_LEAGUE,
  opponent:       "Rivals FC",
  location:       "home",
  teamScore:      80,
  opponentScore:  72,
  result:         "W",
  playedOn:       new Date("2025-03-15T00:00:00.000Z"),
  notes:          null,
  sourceUrl:      null,
  youtubeUrl:     null,
  playerStats:    [],
};

export const VALID_GAME_BODY = {
  seasonLeagueId: VALID_SEASON_LEAGUE,
  opponent:       "Test Rivals",
  location:       "home",
  teamScore:      85,
  opponentScore:  70,
  result:         "W",
  playedOn:       "2025-03-15",
};

export const LISTING_PATHS = ["/", "/players", "/leaderboard", "/games", "/team-stats", "/sitemap.xml"];
export const detailGamePath = (gameId: string) => `/games/${gameId}`;

export function mockRes() {
  const res = {
    statusCode: 200,
    _headers:   {},
    _body:      undefined,
    setHeader(k, v) { Reflect.set(res._headers, k, v); return res; },
    status(code)    { res.statusCode = code; return res; },
    json(body)      { res._body = body; return res; },
    end()           { return res; },
  };
  return res;
}

export function mockReq({ method = "GET", headers = {}, body = {}, query = {}, cookies = {} } = {}) {
  return { method, headers, body, query, cookies };
}

const TEST_CSRF_TOKEN = "test-csrf-token-32bytes-xxxxxxxxx";

export function authCookie() {
  return signSession(JSON.stringify({ ts: Date.now(), role: "admin" }));
}

export function authedReq(overrides = {}) {
  return mockReq({
    headers: { host: "example.com", origin: "https://example.com", "x-csrf-token": TEST_CSRF_TOKEN },
    cookies: { "__Host-ak_session": authCookie(), "__Host-ak_csrf": TEST_CSRF_TOKEN },
    ...overrides,
  });
}

export function mockResWithRevalidate() {
  const res: any = mockRes();
  res.revalidate = vi.fn().mockResolvedValue(undefined);
  return res;
}

export function setupMocks(mockPrisma: any, recalcAggregates: any) {
  vi.clearAllMocks();
  mockPrisma.game.findMany.mockResolvedValue([]);
  mockPrisma.game.create.mockResolvedValue(MOCK_GAME);
  mockPrisma.game.update.mockResolvedValue(MOCK_GAME);
  mockPrisma.game.delete.mockResolvedValue(MOCK_GAME);
  mockPrisma.game.findUniqueOrThrow.mockResolvedValue({ seasonLeagueId: VALID_SEASON_LEAGUE });
  mockPrisma.playerGameStat.createMany.mockResolvedValue({ count: 0 });
  mockPrisma.playerGameStat.deleteMany.mockResolvedValue({ count: 0 });
  if (mockPrisma.playerGameStat.findMany) mockPrisma.playerGameStat.findMany.mockResolvedValue([]);
  if (mockPrisma.player?.findMany)        mockPrisma.player.findMany.mockResolvedValue([]);
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  recalcAggregates.mockResolvedValue(undefined);
}
