// @ts-nocheck
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-admin-recalc-integration";
});

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { seasonLeague: { findMany: vi.fn() } },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/services/stats-recalc", () => ({ recalcAggregates: vi.fn() }));
vi.mock("@/server/services/cache-invalidation", () => ({
  invalidateForRecalc: vi.fn().mockResolvedValue(undefined),
}));

import { recalcAggregates } from "@/server/services/stats-recalc";
import { invalidateForRecalc } from "@/server/services/cache-invalidation";
import handler from "../../../../pages/api/admin/recalc";
import { mockRes, authedReq } from "./__support__/games-admin-mocks";

const SEASON_LEAGUES = [
  { id: "clsl1xxxxxxxxxxxxxxxxxxx", league: { slug: "bc8" },      season: { name: "2025-26" } },
  { id: "clsl2xxxxxxxxxxxxxxxxxxx", league: { slug: "wintercup" }, season: { name: "2025-26" } },
];

const SECRET_LEAK = "connect ECONNREFUSED 10.0.0.5:5432";

function recalcReq() {
  const req = authedReq({ method: "POST" });
  return req;
}

function resWithRevalidate() {
  const res = mockRes();
  res.revalidate = vi.fn().mockResolvedValue(undefined);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.seasonLeague.findMany.mockResolvedValue(SEASON_LEAGUES);
  recalcAggregates.mockResolvedValue(undefined);
  invalidateForRecalc.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/admin/recalc", () => {
  it("returns 200 when every season league recalculates", async () => {
    const res = resWithRevalidate();
    await handler(recalcReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res._body.recalculated).toBe(2);
    expect(res._body.failed).toBe(0);
  });

  it("signals partial failure instead of a clean 200", async () => {
    recalcAggregates
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error(SECRET_LEAK));

    const res = resWithRevalidate();
    await handler(recalcReq(), res);

    expect(res.statusCode).not.toBe(200);
    expect(res._body.failed).toBe(1);
    expect(res._body.error).toBe("1 of 2 season leagues failed to recalculate");
  });

  it("omits the error summary when nothing failed", async () => {
    const res = resWithRevalidate();
    await handler(recalcReq(), res);
    expect(res._body.error).toBeUndefined();
  });

  it("does not leak internal error detail in per-league results in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    recalcAggregates.mockRejectedValue(new Error(SECRET_LEAK));

    const res = resWithRevalidate();
    await handler(recalcReq(), res);

    expect(JSON.stringify(res._body)).not.toContain(SECRET_LEAK);
    expect(JSON.stringify(res._body)).not.toContain("10.0.0.5");
  });

  it("does not leak internal error detail on a top-level failure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockPrisma.seasonLeague.findMany.mockRejectedValue(new Error(SECRET_LEAK));

    const res = resWithRevalidate();
    await handler(recalcReq(), res);

    expect(res.statusCode).toBe(500);
    expect(res._body.error).toBe("Internal server error");
    expect(JSON.stringify(res._body)).not.toContain(SECRET_LEAK);
  });

  it("still reports which season league failed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    recalcAggregates
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error(SECRET_LEAK));

    const res = resWithRevalidate();
    await handler(recalcReq(), res);

    const failed = res._body.results.filter((r) => r.status === "error");
    expect(failed).toHaveLength(1);
    expect(failed[0].label).toBe("2025-26 / wintercup");
  });

  it("rejects non-POST methods", async () => {
    const res = resWithRevalidate();
    await handler(authedReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
  });
});
