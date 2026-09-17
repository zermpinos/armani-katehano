// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-season-leagues";
});

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { seasonLeague: { findMany: vi.fn() } },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/security/node/audit-log", () => ({ auditLog: vi.fn() }));

import handler from "../../../../../pages/api/admin/season-leagues";
import { mockRes, authedReq } from "../../db/__support__/games-admin-mocks";

const ROW = {
  id: "sl1", leagueId: "l1", seasonId: "s1",
  league: { name: "Winter Cup", slug: "basketcity-wintercup" },
  season: { name: "2026-27", year: 2026 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.seasonLeague.findMany.mockResolvedValue([ROW]);
});

const whereOf = () => mockPrisma.seasonLeague.findMany.mock.calls[0][0].where;

describe("GET /api/admin/season-leagues", () => {
  // The import dropdown reads this list. An archived pair offered there lets a
  // hand import file a game into a closed season, which is the one thing
  // resolverInputs and discoverGames both refuse to do.
  it("omits archived seasons by default", async () => {
    const res = mockRes();
    await handler(authedReq({ method: "GET", query: {} }), res);
    expect(res.statusCode).toBe(200);
    expect(whereOf()).toEqual({ season: { archivedAt: null } });
  });

  it("returns every pair when the caller asks for archived ones", async () => {
    const res = mockRes();
    await handler(authedReq({ method: "GET", query: { includeArchived: "true" } }), res);
    expect(res.statusCode).toBe(200);
    expect(whereOf()).toEqual({});
  });

  // Anything other than the exact opt-in stays filtered, so a stray or crafted
  // query string cannot widen the list.
  it("keeps filtering for any value other than true", async () => {
    for (const includeArchived of ["1", "yes", "TRUE", ""]) {
      vi.clearAllMocks();
      mockPrisma.seasonLeague.findMany.mockResolvedValue([ROW]);
      await handler(authedReq({ method: "GET", query: { includeArchived } }), mockRes());
      expect(whereOf()).toEqual({ season: { archivedAt: null } });
    }
  });

  it("carries the season name so two open seasons stay distinguishable", async () => {
    const res = mockRes();
    await handler(authedReq({ method: "GET", query: {} }), res);
    expect(res._body.seasonLeagues[0]).toMatchObject({
      leagueName: "Winter Cup",
      seasonName: "2026-27",
    });
  });
});
