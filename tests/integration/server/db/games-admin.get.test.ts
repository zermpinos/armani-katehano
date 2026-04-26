// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-admin-integration";
});

const { mockPrisma } = vi.hoisted(() => {
  const mp = {
    game: {
      findMany:          vi.fn(),
      create:            vi.fn(),
      update:            vi.fn(),
      delete:            vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    playerGameStat: { createMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  mp.$transaction.mockImplementation(async (fn) => fn(mp));
  return { mockPrisma: mp };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/services/stats-recalc", () => ({
  recalcAggregates: vi.fn().mockResolvedValue(undefined),
}));

import { recalcAggregates } from "@/server/services/stats-recalc";
import handler from "../../../../pages/api/admin/games";
import {
  mockRes, authedReq,
  MOCK_GAME, VALID_CUID, setupMocks,
} from "./__support__/games-admin-mocks";

beforeEach(() => setupMocks(mockPrisma, recalcAggregates));

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
