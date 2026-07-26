// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    upcomingGame: { findMany: vi.fn(), deleteMany: vi.fn() },
    game:         { findMany: vi.fn() },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/security/edge", () => ({ securityHeaders: () => ({ "X-Test": "1" }) }));
vi.mock("@/server/security/node",  () => ({ auditLog: vi.fn() }));

import handler from "../../../../pages/api/cron/purge-upcoming-games";

const NOW = new Date("2026-05-07T10:00:00Z");

function mockReq(overrides: any = {}) {
  return {
    method:  overrides.method  ?? "GET",
    headers: overrides.headers ?? { authorization: "Bearer test-secret" },
  };
}
function mockRes() {
  return {
    statusCode: 0, body: null,
    setHeader: vi.fn(),
    status(c: number) { this.statusCode = c; return this; },
    json(b: any)      { this.body = b;       return this; },
  } as any;
}

const IMPORTED   = "https://basketcity.sportstats.gr/men/gamedetails/id/imported";
const UNIMPORTED = "https://basketcity.sportstats.gr/men/gamedetails/id/pending";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = "test-secret";
  mockPrisma.upcomingGame.findMany.mockResolvedValue([]);
  mockPrisma.game.findMany.mockResolvedValue([]);
  mockPrisma.upcomingGame.deleteMany.mockResolvedValue({ count: 0 });
});

describe("purge-upcoming-games auth", () => {
  it("returns 405 on non-GET", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
    expect(mockPrisma.upcomingGame.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 without bearer", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: {} }), res);
    expect(res.statusCode).toBe(401);
    expect(mockPrisma.upcomingGame.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 with wrong bearer", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "Bearer wrong" } }), res);
    expect(res.statusCode).toBe(401);
    expect(mockPrisma.upcomingGame.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 with mismatched-length bearer (timing-safe guard)", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "Bearer x" } }), res);
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });
});

describe("purge-upcoming-games behavior", () => {
  it("considers only past rows that carry a sourceUrl", async () => {
    await handler(mockReq(), mockRes());
    const args = mockPrisma.upcomingGame.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      scheduledFor: { lt: NOW },
      sourceUrl:    { not: null },
    });
  });

  it("deletes a past row whose sourceUrl has a game", async () => {
    mockPrisma.upcomingGame.findMany.mockResolvedValue([{ id: "u1", sourceUrl: IMPORTED }]);
    mockPrisma.game.findMany.mockResolvedValue([{ sourceUrl: IMPORTED }]);
    mockPrisma.upcomingGame.deleteMany.mockResolvedValue({ count: 1 });

    const res = mockRes();
    await handler(mockReq(), res);

    expect(mockPrisma.upcomingGame.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["u1"] } } });
    expect(res.body).toEqual({ ok: true, deleted: 1 });
  });

  // The poll needs the URL on the fixture before the game is played, so a set
  // sourceUrl no longer means the game was imported. Deleting on the field
  // alone erased the rows the poll retries against after a single attempt.
  it("keeps a past row whose sourceUrl has no game, so the poll can retry it", async () => {
    mockPrisma.upcomingGame.findMany.mockResolvedValue([{ id: "u1", sourceUrl: UNIMPORTED }]);
    mockPrisma.game.findMany.mockResolvedValue([]);

    const res = mockRes();
    await handler(mockReq(), res);

    expect(mockPrisma.upcomingGame.deleteMany).not.toHaveBeenCalled();
    expect(res.body).toEqual({ ok: true, deleted: 0 });
  });

  it("deletes only the imported row when both kinds are past", async () => {
    mockPrisma.upcomingGame.findMany.mockResolvedValue([
      { id: "u1", sourceUrl: IMPORTED },
      { id: "u2", sourceUrl: UNIMPORTED },
    ]);
    mockPrisma.game.findMany.mockResolvedValue([{ sourceUrl: IMPORTED }]);
    mockPrisma.upcomingGame.deleteMany.mockResolvedValue({ count: 1 });

    await handler(mockReq(), mockRes());

    expect(mockPrisma.upcomingGame.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["u1"] } } });
  });

  it("makes no game lookup when nothing is past", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(mockPrisma.game.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.upcomingGame.deleteMany).not.toHaveBeenCalled();
    expect(res.body).toEqual({ ok: true, deleted: 0 });
  });

  it("returns 500 on db error", async () => {
    mockPrisma.upcomingGame.findMany.mockRejectedValue(new Error("boom"));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(500);
  });
});
