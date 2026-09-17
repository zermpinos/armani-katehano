// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-leagues";
});

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    league:       { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    seasonLeague: { create: vi.fn() },
    rosterEntry:  { findMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(fn => fn({
      seasonLeague: { create: vi.fn().mockResolvedValue({ id: "sl1" }) },
      rosterEntry:  { createMany: vi.fn() },
    })),
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/security/node/audit-log", () => ({ auditLog: vi.fn() }));

import handler from "../../../../../pages/api/admin/leagues";
import { authedReq, mockResWithRevalidate } from "../../db/__support__/games-admin-mocks";

const SEASON_ID = "cmrdj8nd0000004la94dnc3jh";
const LEAGUE_ID = "cmrdj8nd0000004la94dnc3ji";
const LISTING   = "https://basketcity.sportstats.gr/men/teamdetails/id/BED40AE7";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.league.findUnique.mockResolvedValue(null);
  mockPrisma.league.create.mockResolvedValue({ id: "l1", slug: "bc6", name: "BC6" });
  mockPrisma.league.update.mockResolvedValue({ id: LEAGUE_ID, slug: "basketcity-bc6", name: "BC6" });
  mockPrisma.rosterEntry.findMany.mockResolvedValue([]);
});

describe("POST /api/admin/leagues", () => {
  it("creates a league and links it to the season", async () => {
    const res = mockResWithRevalidate();
    await handler(authedReq({ method: "POST", body: { name: "BC6", organization: "basketcity", seasonId: SEASON_ID } }), res);
    expect(res.statusCode).toBe(201);
    // Prefixed, so both organizations can run a competition of the same name.
    expect(mockPrisma.league.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: "basketcity-bc6", organization: "basketcity" }) }),
    );
  });

  it("rejects a league whose organization has no parser", async () => {
    const res = mockResWithRevalidate();
    await handler(authedReq({ method: "POST", body: { name: "BC6", organization: "sportsdesk", seasonId: SEASON_ID } }), res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.league.create).not.toHaveBeenCalled();
  });

  // A league that comes back for another year is the normal case, not a typo.
  // Refusing without naming the tool that does link it dead-ends the admin,
  // since this route cannot attach a league it did not just create.
  it("points at the linking tool when the league already exists", async () => {
    mockPrisma.league.findUnique.mockResolvedValue({ id: "l1", slug: "bc6", name: "BC6" });
    const res = mockResWithRevalidate();
    await handler(authedReq({ method: "POST", body: { name: "BC6", organization: "basketcity", seasonId: SEASON_ID } }), res);
    expect(res.statusCode).toBe(409);
    expect(res._body.error).toMatch(/Link existing pair/);
    expect(mockPrisma.league.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/leagues", () => {
  it("sets a listing URL on an existing league", async () => {
    const res = mockResWithRevalidate();
    await handler(authedReq({ method: "PATCH", body: { id: LEAGUE_ID, listingUrl: LISTING } }), res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.league.update).toHaveBeenCalledWith({
      where: { id: LEAGUE_ID },
      data:  { listingUrl: LISTING },
    });
  });

  // The whole point of the route: an edit that names one field must not blank
  // the others. Writing `?? null` across the rest is what emptied listingUrl.
  it("leaves fields the caller did not send untouched", async () => {
    const res = mockResWithRevalidate();
    await handler(authedReq({ method: "PATCH", body: { id: LEAGUE_ID, listingUrl: LISTING } }), res);
    expect(mockPrisma.league.update.mock.calls[0][0].data).not.toHaveProperty("sourceSlug");
  });

  it("clears the listing URL when sent null", async () => {
    const res = mockResWithRevalidate();
    await handler(authedReq({ method: "PATCH", body: { id: LEAGUE_ID, listingUrl: null } }), res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.league.update.mock.calls[0][0].data).toEqual({ listingUrl: null });
  });

  it("rejects a listing URL off the scraper allowlist", async () => {
    const res = mockResWithRevalidate();
    await handler(authedReq({ method: "PATCH", body: { id: LEAGUE_ID, listingUrl: "https://evil.example.com/x" } }), res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.league.update).not.toHaveBeenCalled();
  });

  it("rejects an edit that names no field", async () => {
    const res = mockResWithRevalidate();
    await handler(authedReq({ method: "PATCH", body: { id: LEAGUE_ID } }), res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.league.update).not.toHaveBeenCalled();
  });
});
