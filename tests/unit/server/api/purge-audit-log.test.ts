// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: { deleteMany: vi.fn() },
    cronRun:  { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/server/db/client",     () => ({ default: mockPrisma }));
vi.mock("@/server/security/edge", () => ({ securityHeaders: () => ({ "X-Test": "1" }) }));
vi.mock("@/server/security/node", () => ({ auditLog: vi.fn() }));

import handler from "../../../../pages/api/cron/purge-audit-log";

const NOW = new Date("2026-05-07T05:00:00Z");

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
  mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.cronRun.create.mockResolvedValue({ id: "run-1" });
  mockPrisma.cronRun.update.mockResolvedValue(undefined);
});

describe("purge-audit-log auth", () => {
  it("returns 405 on non-GET", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
    expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 without bearer", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: {} }), res);
    expect(res.statusCode).toBe(401);
    expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 with wrong bearer of equal length", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "Bearer wrong-secret" } }), res);
    expect(res.statusCode).toBe(401);
    expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 with shorter bearer", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "Bearer x" } }), res);
    expect(res.statusCode).toBe(401);
    expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(401);
    expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });
});

describe("purge-audit-log behavior", () => {
  it("deletes rows older than 90 days and returns count", async () => {
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 42 });
    const res = mockRes();
    await handler(mockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, deleted: 42 });

    const ninetyDaysAgo = new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
    expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });
  });

  it("records the run in CronRun with deleted count in summary", async () => {
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 7 });
    const res = mockRes();
    await handler(mockReq(), res);

    expect(mockPrisma.cronRun.create).toHaveBeenCalledWith({
      data: { job: "purgeAuditLog" },
    });
    expect(mockPrisma.cronRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ok: true, summary: { deleted: 7 } }),
      })
    );
  });

  it("returns 500 on DB error and records error in CronRun", async () => {
    mockPrisma.auditLog.deleteMany.mockRejectedValue(new Error("db down"));
    const res = mockRes();
    await handler(mockReq(), res);

    expect(res.statusCode).toBe(500);
    expect(mockPrisma.cronRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ok: false, error: "db down" }),
      })
    );
  });
});
