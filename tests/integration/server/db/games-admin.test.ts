// @ts-nocheck
/**
 * tests/api.games.admin.test.js
 * Integration tests for pages/api/admin/games.js (wrapped in requireAuth).
 *
 * Mocks: lib/prisma (Prisma client), lib/stats.prisma.js (recalcAggregates).
 * requireAuth and all security functions (CSRF, session signing) are real.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

// Set SESSION_SECRET before any module loads -- requireAuth reads it via security.js.
vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-admin-integration";
});

// vi.hoisted() runs before vi.mock() factories, so mockPrisma is accessible in mocks.
const { mockPrisma } = vi.hoisted(() => {
  const mp = {
    game: {
      findMany:           vi.fn(),
      create:             vi.fn(),
      update:             vi.fn(),
      delete:             vi.fn(),
      findUniqueOrThrow:  vi.fn(),
    },
    playerGameStat: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  // Default: transaction calls its callback with the mock client
  mp.$transaction.mockImplementation(async (fn) => fn(mp));
  return { mockPrisma: mp };
});

vi.mock("@/server/db/client", () => ({
  default: mockPrisma,
  prisma:  mockPrisma,
}));

vi.mock("@/server/services/stats-recalc", () => ({
  recalcAggregates: vi.fn().mockResolvedValue(undefined),
}));

import { signSession, SESSION_TTL_S } from "@/server/auth";
import { recalcAggregates } from "@/server/services/stats-recalc";
import handler               from "../../../../pages/api/admin/games";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
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

function mockReq({ method = "GET", headers = {}, body = {}, query = {}, cookies = {} } = {}) {
  return { method, headers, body, query, cookies };
}

function authCookie() {
  return signSession(JSON.stringify({ ts: Date.now(), role: "admin" }));
}

function authedReq(overrides = {}) {
  return mockReq({
    headers: { host: "example.com", origin: "https://example.com" },
    cookies: { "__Host-ak_session": authCookie() },
    ...overrides,
  });
}

const VALID_CUID          = "clxxxxxxxxxxxxxxxxxxxxxx";
const VALID_SEASON_LEAGUE  = "clseasonxxxxxxxxxxxxxxxx";

const MOCK_GAME = {
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

const VALID_GAME_BODY = {
  seasonLeagueId: VALID_SEASON_LEAGUE,
  opponent:       "Test Rivals",
  location:       "home",
  teamScore:      85,
  opponentScore:  70,
  result:         "W",
  playedOn:       "2025-03-15",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.game.findMany.mockResolvedValue([]);
  mockPrisma.game.create.mockResolvedValue(MOCK_GAME);
  mockPrisma.game.update.mockResolvedValue(MOCK_GAME);
  mockPrisma.game.delete.mockResolvedValue(MOCK_GAME);
  mockPrisma.game.findUniqueOrThrow.mockResolvedValue({ seasonLeagueId: VALID_SEASON_LEAGUE });
  mockPrisma.playerGameStat.createMany.mockResolvedValue({ count: 0 });
  mockPrisma.playerGameStat.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
  recalcAggregates.mockResolvedValue(undefined);
});

// ─── requireAuth middleware ───────────────────────────────────────────────────

describe("requireAuth middleware", () => {
  it("returns 401 with no session cookie", async () => {
    const req = mockReq({ method: "GET" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body.error).toMatch(/unauthorized/i);
  });

  it("returns 401 with a malformed session cookie", async () => {
    const req = mockReq({
      method:  "GET",
      cookies: { "__Host-ak_session": "garbage.value" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with an expired session (ts > SESSION_TTL_S ago)", async () => {
    const old = JSON.stringify({ ts: Date.now() - (SESSION_TTL_S + 60) * 1000, role: "admin" });
    const req = mockReq({
      method:  "GET",
      cookies: { "__Host-ak_session": signSession(old) },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body.error).toMatch(/expired/i);
  });

  it("returns 200 with a session 1 second inside the TTL boundary", async () => {
    const fresh = JSON.stringify({ ts: Date.now() - (SESSION_TTL_S - 1) * 1000, role: "admin" });
    const req = mockReq({
      method:  "GET",
      cookies: { "__Host-ak_session": signSession(fresh) },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("returns 403 when Origin mismatches Host on POST", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://evil.com" },
      cookies: { "__Host-ak_session": authCookie() },
      body:    VALID_GAME_BODY,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });
});

// ─── GET /api/admin/games ─────────────────────────────────────────────────────

describe("GET /api/admin/games", () => {
  it("returns 200 with empty games array when there are none", async () => {
    const req = authedReq({ method: "GET" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.games).toEqual([]);
  });

  it("returns 400 for invalid seasonLeagueId query param", async () => {
    const req = authedReq({ method: "GET", query: { seasonLeagueId: "not-a-cuid" } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("scopes the query to seasonLeagueId when provided", async () => {
    mockPrisma.game.findMany.mockResolvedValue([{ ...MOCK_GAME }]);
    const req = authedReq({ method: "GET", query: { seasonLeagueId: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { seasonLeagueId: VALID_CUID } })
    );
  });

  it("includes eff on each box score row (computed via calcEff)", async () => {
    mockPrisma.game.findMany.mockResolvedValue([{
      ...MOCK_GAME,
      playerStats: [{
        playerId: VALID_CUID, minutes: 25,
        pts: 20, reb: 5, orb: 1, drb: 4, ast: 3, stl: 1, blk: 0,
        tov: 2, pf: 2, fgm: 8, fga: 14, fg2m: 6, fg2a: 9,
        fg3m: 2, fg3a: 5, ftm: 2, fta: 3,
        player: { id: VALID_CUID, name: "Test Player", number: 7 },
      }],
    }]);
    const req = authedReq({ method: "GET" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const row = res._body.games[0].boxScore[0];
    expect(typeof row.eff).toBe("number");
    // 20 + 5 + 3 + 1 + 0 - (14-8) - (3-2) - 2 = 20
    expect(row.eff).toBe(20);
  });
});

// ─── POST /api/admin/games ────────────────────────────────────────────────────

describe("POST /api/admin/games", () => {
  it("returns 400 for missing required fields", async () => {
    const req = authedReq({ method: "POST", body: { opponent: "Someone" } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for invalid result value", async () => {
    const req = authedReq({
      method: "POST",
      body:   { ...VALID_GAME_BODY, result: "D" }, // D is not W, L, or T
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 201 with gameId on valid body", async () => {
    const req = authedReq({ method: "POST", body: VALID_GAME_BODY });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._body.ok).toBe(true);
    expect(res._body.gameId).toBe(MOCK_GAME.id);
  });

  it("runs game creation and recalc inside a single transaction", async () => {
    const req = authedReq({ method: "POST", body: VALID_GAME_BODY });
    const res = mockRes();
    await handler(req, res);
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(recalcAggregates).toHaveBeenCalledOnce();
  });

  it("returns 500 when the transaction throws", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("DB error"));
    const req = authedReq({ method: "POST", body: VALID_GAME_BODY });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });
});

// ─── PUT /api/admin/games ─────────────────────────────────────────────────────

describe("PUT /api/admin/games", () => {
  const PUT_BODY = { ...VALID_GAME_BODY, gameId: VALID_CUID };

  it("returns 400 when gameId is missing", async () => {
    const req = authedReq({ method: "PUT", body: VALID_GAME_BODY });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 on valid PUT", async () => {
    const req = authedReq({ method: "PUT", body: PUT_BODY });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.ok).toBe(true);
  });

  it("deletes old playerStats and recalcs inside a transaction", async () => {
    const req = authedReq({ method: "PUT", body: PUT_BODY });
    const res = mockRes();
    await handler(req, res);
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockPrisma.playerGameStat.deleteMany).toHaveBeenCalledOnce();
    expect(recalcAggregates).toHaveBeenCalledOnce();
  });
});

// ─── DELETE /api/admin/games ──────────────────────────────────────────────────

describe("DELETE /api/admin/games", () => {
  const DELETE_BODY = { gameId: VALID_CUID };

  it("returns 400 when gameId is missing", async () => {
    const req = authedReq({
      method: "DELETE",
      body:   { seasonLeagueId: VALID_SEASON_LEAGUE },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 and triggers delete + recalc inside a transaction", async () => {
    const req = authedReq({ method: "DELETE", body: DELETE_BODY });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.ok).toBe(true);
    expect(mockPrisma.game.delete).toHaveBeenCalledWith({ where: { id: VALID_CUID } });
    expect(recalcAggregates).toHaveBeenCalledWith(VALID_SEASON_LEAGUE, mockPrisma);
  });
});

// ─── ISR revalidation ────────────────────────────────────────────────────────
//
// revalidate is a Next.js-only method -- plain API route handlers must not
// crash when it is absent. These tests cover both sides: the handler must
// call revalidate when present, and must still succeed when it is not.

const ISR_PATHS = ["/", "/players", "/leaderboard", "/games", "/team-stats"];

function mockResWithRevalidate() {
  const res: any = mockRes();
  res.revalidate = vi.fn().mockResolvedValue(undefined);
  return res;
}

describe("ISR revalidation", () => {
  it("POST calls revalidate for every ISR path on success", async () => {
    const req = authedReq({ method: "POST", body: VALID_GAME_BODY });
    const res = mockResWithRevalidate();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.revalidate).toHaveBeenCalledTimes(ISR_PATHS.length);
    for (const path of ISR_PATHS) expect(res.revalidate).toHaveBeenCalledWith(path);
  });

  it("PUT calls revalidate for every ISR path on success", async () => {
    const req = authedReq({ method: "PUT", body: { ...VALID_GAME_BODY, gameId: VALID_CUID } });
    const res = mockResWithRevalidate();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.revalidate).toHaveBeenCalledTimes(ISR_PATHS.length);
    for (const path of ISR_PATHS) expect(res.revalidate).toHaveBeenCalledWith(path);
  });

  it("DELETE calls revalidate for every ISR path on success", async () => {
    const req = authedReq({ method: "DELETE", body: { gameId: VALID_CUID } });
    const res = mockResWithRevalidate();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.revalidate).toHaveBeenCalledTimes(ISR_PATHS.length);
    for (const path of ISR_PATHS) expect(res.revalidate).toHaveBeenCalledWith(path);
  });

  it("POST succeeds with correct status when revalidate is absent", async () => {
    const req = authedReq({ method: "POST", body: VALID_GAME_BODY });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
  });

  it("PUT succeeds with correct status when revalidate is absent", async () => {
    const req = authedReq({ method: "PUT", body: { ...VALID_GAME_BODY, gameId: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("DELETE succeeds with correct status when revalidate is absent", async () => {
    const req = authedReq({ method: "DELETE", body: { gameId: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });
});

// ─── Unsupported methods ──────────────────────────────────────────────────────

describe("unsupported methods", () => {
  it("returns 405 for PATCH", async () => {
    const req = authedReq({ method: "PATCH", body: {} });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
