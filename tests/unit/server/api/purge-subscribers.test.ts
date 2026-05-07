// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscriber: { deleteMany: vi.fn() },
  },
}));

vi.mock("@/server/db/client",     () => ({ default: mockPrisma }));
vi.mock("@/server/security/edge", () => ({ securityHeaders: () => ({ "X-Test": "1" }) }));
vi.mock("@/server/security/node", () => ({ auditLog: vi.fn() }));

import handler from "../../../../pages/api/cron/purge-subscribers";

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
  mockPrisma.subscriber.deleteMany.mockResolvedValue({ count: 0 });
});

describe("purge-subscribers auth", () => {
  it("returns 405 on non-GET", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
    expect(mockPrisma.subscriber.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 without bearer", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: {} }), res);
    expect(res.statusCode).toBe(401);
    expect(mockPrisma.subscriber.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 with wrong bearer of equal length", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "Bearer wrong-secret" } }), res);
    expect(res.statusCode).toBe(401);
    expect(mockPrisma.subscriber.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 with shorter bearer (length-guard prevents timingSafeEqual throw)", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "Bearer x" } }), res);
    expect(res.statusCode).toBe(401);
    expect(mockPrisma.subscriber.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(401);
    expect(mockPrisma.subscriber.deleteMany).not.toHaveBeenCalled();
  });
});

describe("purge-subscribers behavior", () => {
  it("deletes unconfirmed subscribers older than 1 day and expired confirmed ones, returns counts", async () => {
    mockPrisma.subscriber.deleteMany
      .mockResolvedValueOnce({ count: 2 })  // unconfirmed
      .mockResolvedValueOnce({ count: 5 }); // expired
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, unconfirmedDeleted: 2, expiredDeleted: 5 });
    expect(mockPrisma.subscriber.deleteMany).toHaveBeenCalledTimes(2);

    const oneDayAgo  = new Date(NOW.getTime() - 86_400 * 1000);
    const oneYearAgo = new Date(NOW.getTime() - 365 * 86_400 * 1000);

    const unconfirmedArgs = mockPrisma.subscriber.deleteMany.mock.calls[0][0];
    expect(unconfirmedArgs).toEqual({
      where: { confirmedAt: null, createdAt: { lt: oneDayAgo } },
    });

    const expiredArgs = mockPrisma.subscriber.deleteMany.mock.calls[1][0];
    expect(expiredArgs).toEqual({
      where: {
        confirmedAt: { not: null },
        OR: [
          { lastEmailedAt: { lt: oneYearAgo } },
          { lastEmailedAt: null, confirmedAt: { not: null, lt: oneYearAgo } },
        ],
      },
    });
  });

  it("returns 500 on db error", async () => {
    mockPrisma.subscriber.deleteMany.mockRejectedValue(new Error("boom"));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(500);
  });
});
