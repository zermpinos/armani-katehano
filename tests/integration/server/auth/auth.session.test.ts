// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-auth-integration";
});

vi.mock("@/server/auth", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifyCredentials: vi.fn(),
    getAdminUser:      vi.fn(),
    verifyTotp:        vi.fn(),
    verifyCaptcha:     vi.fn(),
    isLockedOut:       vi.fn().mockResolvedValue(false),
    recordAttempt:     vi.fn().mockResolvedValue(undefined),
    clearAttempts:     vi.fn().mockResolvedValue(undefined),
    getFailureCount:   vi.fn().mockResolvedValue(0),
  };
});

import { isLockedOut, getFailureCount, verifyCredentials, getAdminUser, verifyTotp, verifyCaptcha, signSession } from "@/server/auth";
import handler from "../../../../pages/api/auth";
import { mockRes, mockReq } from "./__support__/auth-mocks";

function validSessionCookie() {
  return signSession(JSON.stringify({ ts: Date.now(), role: "admin" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  isLockedOut.mockResolvedValue(false);
  getFailureCount.mockResolvedValue(0);
  verifyCredentials.mockResolvedValue(false);
  getAdminUser.mockReturnValue(null);
  verifyTotp.mockReturnValue(true);
  verifyCaptcha.mockResolvedValue(true);
});

describe("GET /api/auth", () => {
  it("returns 200 when a valid session cookie is present", async () => {
    const req = mockReq({
      method:  "GET",
      cookies: { "__Host-ak_session": validSessionCookie() },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual({ ok: true });
  });

  it("returns 401 when no session cookie", async () => {
    const req = mockReq({ method: "GET" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when session cookie is malformed", async () => {
    const req = mockReq({
      method:  "GET",
      cookies: { "__Host-ak_session": "totally.invalid" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});
