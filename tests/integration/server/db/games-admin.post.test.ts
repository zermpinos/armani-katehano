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
  MOCK_GAME, VALID_GAME_BODY, setupMocks,
} from "./__support__/games-admin-mocks";

beforeEach(() => setupMocks(mockPrisma, recalcAggregates));

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
      body:   { ...VALID_GAME_BODY, result: "D" },
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
