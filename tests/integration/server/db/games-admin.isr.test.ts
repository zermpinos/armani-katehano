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
  mockRes, mockResWithRevalidate, authedReq,
  VALID_GAME_BODY, VALID_CUID, ISR_PATHS, setupMocks,
} from "./__support__/games-admin-mocks";

beforeEach(() => setupMocks(mockPrisma, recalcAggregates));

// revalidate is a Next.js-only method — plain API route handlers must not
// crash when it is absent. These tests cover both sides: the handler must
// call revalidate when present, and must still succeed when it is not.

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
