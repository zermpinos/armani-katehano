// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma, mockAuditLog } = vi.hoisted(() => ({
  mockPrisma: {
    subscriber: {
      findUnique: vi.fn(),
      update:     vi.fn(),
      delete:     vi.fn(),
    },
  },
  mockAuditLog: vi.fn(),
}));

vi.mock("@/server/db/client",     () => ({ default: mockPrisma }));
vi.mock("@/server/security/node", () => ({ auditLog: mockAuditLog }));
vi.mock("@/server/security/edge", () => ({ securityHeaders: () => ({}) }));

import handler from "../../../../pages/api/confirm";

const VALID_TOKEN = "a".repeat(64);

function mockReq(overrides: any = {}) {
  return {
    method: overrides.method ?? "GET",
    query:  overrides.query  ?? { token: VALID_TOKEN },
  };
}

function mockRes() {
  return {
    statusCode:   0,
    body:         null as any,
    redirectCode: null as number | null,
    redirectUrl:  null as string | null,
    status(c: number)              { this.statusCode = c; return this; },
    json(b: any)                   { this.body = b;       return this; },
    redirect(c: number, u: string) { this.redirectCode = c; this.redirectUrl = u; return this; },
    setHeader()                    { return this; },
  } as any;
}

const recentSubscriber = () => ({
  id:           "cl1",
  confirmToken: VALID_TOKEN,
  confirmedAt:  null,
  createdAt:    new Date(),
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "";
  mockPrisma.subscriber.findUnique.mockResolvedValue(recentSubscriber());
  mockPrisma.subscriber.update.mockResolvedValue({});
  mockPrisma.subscriber.delete.mockResolvedValue({});
});

describe("GET /api/confirm -- valid confirmToken", () => {
  it("looks up subscriber by confirmToken field (not the token field)", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(mockPrisma.subscriber.findUnique).toHaveBeenCalledWith({
      where: { confirmToken: VALID_TOKEN },
    });
  });

  it("updates confirmedAt and nulls out confirmToken in one write", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(mockPrisma.subscriber.update).toHaveBeenCalledWith({
      where: { confirmToken: VALID_TOKEN },
      data:  { confirmedAt: expect.any(Date), confirmToken: null },
    });
  });

  it("redirects to ?confirmed=1 on success", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.redirectCode).toBe(302);
    expect(res.redirectUrl).toBe("/?confirmed=1");
  });

  it("writes subscriber_confirmed audit log", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(mockAuditLog).toHaveBeenCalledWith(
      "subscriber_confirmed",
      expect.objectContaining({ tokenPrefix: expect.any(String) }),
    );
  });
});

describe("GET /api/confirm -- not found (token used or invalid)", () => {
  it("redirects to ?confirmed=1 when confirmToken is not found", async () => {
    mockPrisma.subscriber.findUnique.mockResolvedValue(null);
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.redirectCode).toBe(302);
    expect(res.redirectUrl).toBe("/?confirmed=1");
    expect(mockPrisma.subscriber.update).not.toHaveBeenCalled();
  });

  it("does NOT redirect to ?confirmed=0 for any not-found case", async () => {
    mockPrisma.subscriber.findUnique.mockResolvedValue(null);
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.redirectUrl).not.toContain("confirmed=0");
  });
});

describe("GET /api/confirm -- expired token", () => {
  it("deletes the subscriber row and redirects to ?confirmed=expired", async () => {
    const oldDate = new Date(Date.now() - 25 * 3600 * 1000);
    mockPrisma.subscriber.findUnique.mockResolvedValue({
      ...recentSubscriber(),
      createdAt: oldDate,
    });
    const res = mockRes();
    await handler(mockReq(), res);
    expect(mockPrisma.subscriber.delete).toHaveBeenCalledWith({
      where: { confirmToken: VALID_TOKEN },
    });
    expect(res.redirectUrl).toBe("/?confirmed=expired");
    expect(mockAuditLog).toHaveBeenCalledWith(
      "subscriber_confirm_expired",
      expect.any(Object),
    );
  });

  it("does NOT call update when token is expired", async () => {
    mockPrisma.subscriber.findUnique.mockResolvedValue({
      ...recentSubscriber(),
      createdAt: new Date(Date.now() - 25 * 3600 * 1000),
    });
    const res = mockRes();
    await handler(mockReq(), res);
    expect(mockPrisma.subscriber.update).not.toHaveBeenCalled();
  });

  it("redirects to ?confirmed=expired (not 500) when expiry delete races with a concurrent request", async () => {
    mockPrisma.subscriber.findUnique.mockResolvedValue({
      ...recentSubscriber(),
      createdAt: new Date(Date.now() - 25 * 3600 * 1000),
    });
    mockPrisma.subscriber.delete.mockRejectedValue(
      Object.assign(new Error("Record not found"), { code: "P2025" }),
    );
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.redirectUrl).toBe("/?confirmed=expired");
    expect(res.statusCode).not.toBe(500);
  });
});

describe("GET /api/confirm -- P2025 race condition", () => {
  it("redirects to ?confirmed=1 (not 500) when update finds no row (concurrent confirm)", async () => {
    mockPrisma.subscriber.update.mockRejectedValue(
      Object.assign(new Error("Record to update not found"), { code: "P2025" }),
    );
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.redirectCode).toBe(302);
    expect(res.redirectUrl).toBe("/?confirmed=1");
    expect(res.statusCode).not.toBe(500);
  });

  it("still returns 500 for non-P2025 update errors", async () => {
    mockPrisma.subscriber.update.mockRejectedValue(new Error("connection lost"));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe("GET /api/confirm -- input validation", () => {
  it("returns 400 when token query param is missing", async () => {
    const res = mockRes();
    await handler({ method: "GET", query: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.subscriber.findUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when token is too short (< 32 chars)", async () => {
    const res = mockRes();
    await handler(mockReq({ query: { token: "tooshort" } }), res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.subscriber.findUnique).not.toHaveBeenCalled();
  });
});

describe("Method routing", () => {
  it("returns 405 for POST", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
  });
});
