// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-seasons-update";
});

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    season:       { findUnique: vi.fn(), update: vi.fn() },
    seasonLeague: { createMany: vi.fn() },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/security/node/audit-log", () => ({ auditLog: vi.fn() }));

import handler from "../../../../../pages/api/admin/seasons/[id]/index";
import { authedReq, mockResWithRevalidate } from "../../db/__support__/games-admin-mocks";

const SEASON = {
  id: "s1", name: "2026-27", year: 2026,
  startDate: null, endDate: null, archivedAt: null, createdAt: new Date("2026-07-01"),
};

function patch(body, query = { id: "s1" }) {
  return authedReq({ method: "PATCH", query, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.season.findUnique.mockResolvedValue(SEASON);
  mockPrisma.season.update.mockImplementation(({ data }) => Promise.resolve({ ...SEASON, ...data }));
  mockPrisma.seasonLeague.createMany.mockResolvedValue({ count: 1 });
});

describe("PATCH /api/admin/seasons/[id]", () => {
  it("stores the boundaries at UTC midnight so a game played on the end date still counts", async () => {
    const res = mockResWithRevalidate();
    await handler(patch({ startDate: "2026-09-01", endDate: "2027-07-31" }), res);
    expect(res.statusCode).toBe(200);
    const { data } = mockPrisma.season.update.mock.calls[0][0];
    expect(data.startDate.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(data.endDate.toISOString()).toBe("2027-07-31T00:00:00.000Z");
  });

  it("clears a boundary when the input is emptied", async () => {
    const res = mockResWithRevalidate();
    await handler(patch({ endDate: "" }), res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.season.update.mock.calls[0][0].data).toEqual({ endDate: null });
  });

  it("leaves an omitted boundary alone", async () => {
    const res = mockResWithRevalidate();
    await handler(patch({ startDate: "2026-09-01" }), res);
    expect(mockPrisma.season.update.mock.calls[0][0].data).not.toHaveProperty("endDate");
  });

  // A reversed range covers no date, so every later import would quietly stop
  // resolving a season instead of failing here.
  it("refuses a range that ends before it starts", async () => {
    const res = mockResWithRevalidate();
    await handler(patch({ startDate: "2026-09-01", endDate: "2026-08-01" }), res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.season.update).not.toHaveBeenCalled();
  });

  it("compares a new boundary against the one already stored", async () => {
    mockPrisma.season.findUnique.mockResolvedValue({ ...SEASON, startDate: new Date("2026-09-01T00:00:00.000Z") });
    const res = mockResWithRevalidate();
    await handler(patch({ endDate: "2026-08-01" }), res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.season.update).not.toHaveBeenCalled();
  });

  it("accepts a single-day season", async () => {
    const res = mockResWithRevalidate();
    await handler(patch({ startDate: "2026-09-01", endDate: "2026-09-01" }), res);
    expect(res.statusCode).toBe(200);
  });

  // Linking used to POST the existing season name into season.create, which the
  // unique constraint on name rejected, so no league could ever be linked to a
  // season that already existed.
  it("links a league to a season that already exists", async () => {
    const res = mockResWithRevalidate();
    await handler(patch({ leagueIds: ["clh0000000000000000000000"] }), res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.seasonLeague.createMany).toHaveBeenCalledWith({
      data: [{ seasonId: "s1", leagueId: "clh0000000000000000000000" }],
      skipDuplicates: true,
    });
  });

  it("does not touch links when none are sent", async () => {
    const res = mockResWithRevalidate();
    await handler(patch({ startDate: "2026-09-01" }), res);
    expect(mockPrisma.seasonLeague.createMany).not.toHaveBeenCalled();
  });

  it("rejects a date that is not a calendar day", async () => {
    const res = mockResWithRevalidate();
    await handler(patch({ startDate: "September 2026" }), res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.season.update).not.toHaveBeenCalled();
  });

  it("404s an unknown season", async () => {
    mockPrisma.season.findUnique.mockResolvedValue(null);
    const res = mockResWithRevalidate();
    await handler(patch({ startDate: "2026-09-01" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("rejects any method other than PATCH", async () => {
    const res = mockResWithRevalidate();
    await handler(authedReq({ method: "POST", query: { id: "s1" }, body: {} }), res);
    expect(res.statusCode).toBe(405);
  });
});
