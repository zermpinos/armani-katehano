// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-recalc-tx-integration";
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
    playerGameStat: { createMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    upcomingGame:   { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    player:         { findMany: vi.fn() },
    auditLog:       { create: vi.fn().mockResolvedValue(undefined) },
    $transaction:   vi.fn(),
  };
  return { mockPrisma: mp };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/services/stats-recalc", () => ({ recalcAggregates: vi.fn() }));
vi.mock("@/server/services/cache-invalidation", () => ({
  invalidateForGameMutation: vi.fn().mockResolvedValue(undefined),
}));

import { recalcAggregates } from "@/server/services/stats-recalc";
import { invalidateForGameMutation } from "@/server/services/cache-invalidation";
import handler from "../../../../pages/api/admin/games";
import {
  mockRes, authedReq, MOCK_GAME, VALID_GAME_BODY,
  VALID_SEASON_LEAGUE, setupMocks,
} from "./__support__/games-admin-mocks";

const OTHER_SEASON_LEAGUE = "clotherleaguexxxxxxxxxxx";

let insideTx = false;

beforeEach(() => {
  setupMocks(mockPrisma, recalcAggregates);
  insideTx = false;
  mockPrisma.upcomingGame.deleteMany.mockResolvedValue({ count: 0 });
  invalidateForGameMutation.mockResolvedValue(undefined);
  mockPrisma.$transaction.mockImplementation(async (fn) => {
    insideTx = true;
    try {
      return await fn(mockPrisma);
    } finally {
      insideTx = false;
    }
  });
});

function trackRecalcScope() {
  const seen: boolean[] = [];
  recalcAggregates.mockImplementation(async () => { seen.push(insideTx); });
  return seen;
}

describe("POST /api/admin/games aggregate transactionality", () => {
  it("recalculates inside the game-write transaction", async () => {
    const seen = trackRecalcScope();
    await handler(authedReq({ method: "POST", body: VALID_GAME_BODY }), mockRes());
    expect(seen).toEqual([true]);
  });

  it("passes the transaction client to recalcAggregates", async () => {
    await handler(authedReq({ method: "POST", body: VALID_GAME_BODY }), mockRes());
    expect(recalcAggregates).toHaveBeenCalledWith(VALID_SEASON_LEAGUE, mockPrisma);
  });

  it("returns 500 rather than 201 when recalc fails", async () => {
    recalcAggregates.mockRejectedValue(new Error("recalc exploded"));
    const res = mockRes();
    await handler(authedReq({ method: "POST", body: VALID_GAME_BODY }), res);
    expect(res.statusCode).toBe(500);
    expect(res._body.ok).toBeUndefined();
  });

  it("does not revalidate caches when recalc fails", async () => {
    recalcAggregates.mockRejectedValue(new Error("recalc exploded"));
    await handler(authedReq({ method: "POST", body: VALID_GAME_BODY }), mockRes());
    expect(invalidateForGameMutation).not.toHaveBeenCalled();
  });
});

describe("PUT /api/admin/games aggregate transactionality", () => {
  const putBody = { ...VALID_GAME_BODY, gameId: MOCK_GAME.id };

  it("recalculates inside the game-write transaction", async () => {
    const seen = trackRecalcScope();
    await handler(authedReq({ method: "PUT", body: putBody }), mockRes());
    expect(seen).toEqual([true]);
  });

  it("recalculates both leagues inside one transaction when the league changes", async () => {
    mockPrisma.game.findUniqueOrThrow.mockResolvedValue({ seasonLeagueId: OTHER_SEASON_LEAGUE });
    const seen = trackRecalcScope();

    await handler(
      authedReq({ method: "PUT", body: { ...putBody, seasonLeagueId: VALID_SEASON_LEAGUE } }),
      mockRes(),
    );

    expect(seen).toEqual([true, true]);
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(recalcAggregates).toHaveBeenNthCalledWith(1, OTHER_SEASON_LEAGUE, mockPrisma);
    expect(recalcAggregates).toHaveBeenNthCalledWith(2, VALID_SEASON_LEAGUE, mockPrisma);
  });

  it("returns 500 rather than 200 when recalc fails", async () => {
    recalcAggregates.mockRejectedValue(new Error("recalc exploded"));
    const res = mockRes();
    await handler(authedReq({ method: "PUT", body: putBody }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe("DELETE /api/admin/games aggregate transactionality", () => {
  const delBody = { gameId: MOCK_GAME.id };

  it("recalculates inside the delete transaction", async () => {
    const seen = trackRecalcScope();
    await handler(authedReq({ method: "DELETE", body: delBody }), mockRes());
    expect(seen).toEqual([true]);
  });

  it("passes the transaction client to recalcAggregates", async () => {
    await handler(authedReq({ method: "DELETE", body: delBody }), mockRes());
    expect(recalcAggregates).toHaveBeenCalledWith(VALID_SEASON_LEAGUE, mockPrisma);
  });

  it("returns 500 rather than 200 when recalc fails", async () => {
    recalcAggregates.mockRejectedValue(new Error("recalc exploded"));
    const res = mockRes();
    await handler(authedReq({ method: "DELETE", body: delBody }), res);
    expect(res.statusCode).toBe(500);
  });
});
