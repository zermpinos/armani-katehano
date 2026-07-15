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
    playerGameStat: { createMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    player:         { findMany: vi.fn() },
    upcomingGame:   { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
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
  VALID_GAME_BODY, VALID_CUID, VALID_SEASON_LEAGUE, setupMocks,
} from "./__support__/games-admin-mocks";

beforeEach(() => setupMocks(mockPrisma, recalcAggregates));

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

describe("unsupported methods", () => {
  it("returns 405 for PATCH", async () => {
    const req = authedReq({ method: "PATCH", body: {} });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
