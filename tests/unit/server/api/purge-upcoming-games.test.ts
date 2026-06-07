// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    upcomingGame: { deleteMany: vi.fn() },
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = "test-secret";
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
  it("deletes UpcomingGame rows with scheduledFor < now and sourceUrl set", async () => {
    mockPrisma.upcomingGame.deleteMany.mockResolvedValue({ count: 3 });
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.upcomingGame.deleteMany).toHaveBeenCalledTimes(1);
    const args = mockPrisma.upcomingGame.deleteMany.mock.calls[0][0];
    expect(args.where).toEqual({
      scheduledFor: { lt: NOW },
      sourceUrl:    { not: null },
    });
    expect(res.body).toEqual({ ok: true, deleted: 3 });
  });

  it("returns 0 when nothing to purge", async () => {
    mockPrisma.upcomingGame.deleteMany.mockResolvedValue({ count: 0 });
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, deleted: 0 });
  });

  it("returns 500 on db error", async () => {
    mockPrisma.upcomingGame.deleteMany.mockRejectedValue(new Error("boom"));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(500);
  });
});
