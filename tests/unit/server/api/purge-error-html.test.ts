// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPurge } = vi.hoisted(() => ({
  mockPurge: vi.fn(),
}));

vi.mock("@/server/services/import-job", () => ({ purgeStaleErrorHtml: mockPurge }));
vi.mock("@/server/security/edge",       () => ({ securityHeaders: () => ({ "X-Test": "1" }) }));
vi.mock("@/server/security/node",       () => ({ auditLog: vi.fn() }));

import handler from "../../../../pages/api/cron/purge-error-html";

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
  process.env.CRON_SECRET = "test-secret";
  mockPurge.mockResolvedValue(undefined);
});

describe("purge-error-html auth", () => {
  it("returns 405 on non-GET", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
    expect(mockPurge).not.toHaveBeenCalled();
  });

  it("returns 401 without bearer", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: {} }), res);
    expect(res.statusCode).toBe(401);
    expect(mockPurge).not.toHaveBeenCalled();
  });

  it("returns 401 with wrong bearer of equal length", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "Bearer wrong-secret" } }), res);
    expect(res.statusCode).toBe(401);
    expect(mockPurge).not.toHaveBeenCalled();
  });

  it("returns 401 with shorter bearer (length-guard prevents timingSafeEqual throw)", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "Bearer x" } }), res);
    expect(res.statusCode).toBe(401);
    expect(mockPurge).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(401);
    expect(mockPurge).not.toHaveBeenCalled();
  });
});

describe("purge-error-html behavior", () => {
  it("calls purgeStaleErrorHtml and returns 200", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockPurge).toHaveBeenCalledTimes(1);
  });

  it("returns 500 on service error", async () => {
    mockPurge.mockRejectedValue(new Error("boom"));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(500);
  });
});
