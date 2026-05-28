// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma, mockCsrfCheck, mockSendConfirmationEmail, mockRandomBytes } = vi.hoisted(() => ({
  mockPrisma: {
    subscriber: {
      findUnique: vi.fn(),
      create:     vi.fn(),
      delete:     vi.fn(),
      deleteMany: vi.fn(),
    },
    loginAttempt: {
      count:  vi.fn(),
      create: vi.fn(),
    },
  },
  mockCsrfCheck:              vi.fn(),
  mockSendConfirmationEmail:  vi.fn(),
  mockRandomBytes:            vi.fn(),
}));

vi.mock("@/server/db/client",                          () => ({ default: mockPrisma }));
vi.mock("@/server/integrations/email/client",          () => ({ sendConfirmationEmail: mockSendConfirmationEmail }));
vi.mock("node:crypto",                                 () => ({ randomBytes: mockRandomBytes }));
vi.mock("@/server/auth",                               () => ({ csrfCheck: mockCsrfCheck, rlKey: (k: string) => k }));
vi.mock("@/server/security/edge",                      () => ({ securityHeaders: () => ({}) }));
vi.mock("@/server/security/node",                      () => ({ getClientIp: () => "127.0.0.1", auditLog: vi.fn(), rlKey: (k: string) => k }));

import handler from "../../../../pages/api/subscribe";

const mkBuf = (hex: string) => ({ toString: (_enc?: string) => hex });
const TOKEN        = "a".repeat(64);
const CONFIRM_TOKEN = "b".repeat(64);

function mockReq(overrides: any = {}) {
  return {
    method:  overrides.method  ?? "POST",
    query:   overrides.query   ?? {},
    body:    overrides.body    ?? {},
    headers: overrides.headers ?? {},
  };
}

function mockRes() {
  return {
    statusCode: 0,
    body: null as any,
    status(c: number) { this.statusCode = c; return this; },
    json(b: any)      { this.body = b;       return this; },
    setHeader()       { return this; },
    end()             { return this; },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCsrfCheck.mockReturnValue(true);
  mockRandomBytes
    .mockReturnValueOnce(mkBuf(TOKEN))
    .mockReturnValueOnce(mkBuf(CONFIRM_TOKEN));
  mockPrisma.loginAttempt.count.mockResolvedValue(0);
  mockPrisma.loginAttempt.create.mockResolvedValue({});
  mockPrisma.subscriber.findUnique.mockResolvedValue(null);
  mockPrisma.subscriber.create.mockResolvedValue({});
  mockPrisma.subscriber.deleteMany.mockResolvedValue({ count: 0 });
  mockSendConfirmationEmail.mockResolvedValue(undefined);
});

describe("POST /api/subscribe -- happy path", () => {
  it("returns 201 on successful subscription", async () => {
    const res = mockRes();
    await handler(mockReq({ body: { email: "user@example.com" } }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it("stores both token (unsubscribe) and confirmToken (confirm) on the subscriber row", async () => {
    const res = mockRes();
    await handler(mockReq({ body: { email: "user@example.com" } }), res);
    expect(mockPrisma.subscriber.create).toHaveBeenCalledWith({
      data: {
        email:        "user@example.com",
        token:        TOKEN,
        confirmToken: CONFIRM_TOKEN,
        confirmedAt:  null,
      },
    });
  });

  it("calls sendConfirmationEmail with email and confirmToken -- not the unsubscribe token", async () => {
    const res = mockRes();
    await handler(mockReq({ body: { email: "user@example.com" } }), res);
    expect(mockSendConfirmationEmail).toHaveBeenCalledWith({
      email:        "user@example.com",
      confirmToken: CONFIRM_TOKEN,
    });
    // Must NOT pass the unsubscribe token or a pre-built URL
    expect(mockSendConfirmationEmail).not.toHaveBeenCalledWith(
      expect.objectContaining({ token: TOKEN }),
    );
    expect(mockSendConfirmationEmail).not.toHaveBeenCalledWith(
      expect.objectContaining({ confirmUrl: expect.anything() }),
    );
  });

  it("stamps the email cooldown only after a successful email send", async () => {
    const res = mockRes();
    await handler(mockReq({ body: { email: "user@example.com" } }), res);
    // loginAttempt.create is called twice: once for IP rate-limit, once for email cooldown
    expect(mockPrisma.loginAttempt.create).toHaveBeenCalledTimes(2);
  });

  it("generates two independent 32-byte tokens -- randomBytes called twice with 32", async () => {
    const res = mockRes();
    await handler(mockReq({ body: { email: "user@example.com" } }), res);
    expect(mockRandomBytes).toHaveBeenCalledTimes(2);
    expect(mockRandomBytes.mock.calls[0][0]).toBe(32);
    expect(mockRandomBytes.mock.calls[1][0]).toBe(32);
  });
});

describe("POST /api/subscribe -- duplicate / race conditions", () => {
  it("returns 200 silently when email is already in the database", async () => {
    mockPrisma.subscriber.findUnique.mockResolvedValue({ id: "cl1", email: "user@example.com" });
    const res = mockRes();
    await handler(mockReq({ body: { email: "user@example.com" } }), res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.subscriber.create).not.toHaveBeenCalled();
    expect(mockSendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("returns 200 silently on P2002 (concurrent insert race)", async () => {
    mockPrisma.subscriber.create.mockRejectedValue(
      Object.assign(new Error("unique constraint"), { code: "P2002" }),
    );
    const res = mockRes();
    await handler(mockReq({ body: { email: "user@example.com" } }), res);
    expect(res.statusCode).toBe(200);
    expect(mockSendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("returns 200 silently when email cooldown is active", async () => {
    mockPrisma.loginAttempt.count
      .mockResolvedValueOnce(0)  // IP rate limit: OK
      .mockResolvedValueOnce(1); // email cooldown: active
    const res = mockRes();
    await handler(mockReq({ body: { email: "user@example.com" } }), res);
    expect(res.statusCode).toBe(200);
    expect(mockSendConfirmationEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/subscribe -- error paths", () => {
  it("returns 429 when IP rate limit is exceeded", async () => {
    mockPrisma.loginAttempt.count.mockResolvedValueOnce(3);
    const res = mockRes();
    await handler(mockReq({ body: { email: "user@example.com" } }), res);
    expect(res.statusCode).toBe(429);
    expect(mockSendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid email", async () => {
    const res = mockRes();
    await handler(mockReq({ body: { email: "not-an-email" } }), res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 on CSRF failure", async () => {
    mockCsrfCheck.mockReturnValueOnce(false);
    const res = mockRes();
    await handler(mockReq({ body: { email: "user@example.com" } }), res);
    expect(res.statusCode).toBe(403);
    expect(mockSendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("rolls back the subscriber row (delete by token) and returns 500 when email send fails", async () => {
    mockSendConfirmationEmail.mockRejectedValue(new Error("smtp down"));
    const res = mockRes();
    await handler(mockReq({ body: { email: "user@example.com" } }), res);
    expect(mockPrisma.subscriber.delete).toHaveBeenCalledWith({ where: { token: TOKEN } });
    expect(res.statusCode).toBe(500);
  });
});

describe("DELETE /api/subscribe -- unsubscribe", () => {
  it("returns 200 and deletes by token", async () => {
    mockPrisma.subscriber.delete.mockResolvedValue({});
    const res = mockRes();
    await handler(mockReq({ method: "DELETE", body: { token: TOKEN } }), res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.subscriber.delete).toHaveBeenCalledWith({ where: { token: TOKEN } });
  });

  it("returns 200 silently when token is not found (no token enumeration)", async () => {
    mockPrisma.subscriber.delete.mockRejectedValue(new Error("not found"));
    const res = mockRes();
    await handler(mockReq({ method: "DELETE", body: { token: TOKEN } }), res);
    expect(res.statusCode).toBe(200);
  });

  it("returns 400 on invalid/missing token", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "DELETE", body: { token: "tooshort" } }), res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 on CSRF failure", async () => {
    mockCsrfCheck.mockReturnValueOnce(false);
    const res = mockRes();
    await handler(mockReq({ method: "DELETE", body: { token: TOKEN } }), res);
    expect(res.statusCode).toBe(403);
  });
});

describe("Method routing", () => {
  it("returns 405 for unsupported methods", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "PUT" }), res);
    expect(res.statusCode).toBe(405);
  });
});
