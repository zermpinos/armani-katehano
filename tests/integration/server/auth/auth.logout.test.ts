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
    clearAttempts:     vi.fn().mockResolvedValue(undefined),
    getFailureCount:   vi.fn().mockResolvedValue(0),
  };
});

import { isLockedOut, getFailureCount, verifyCredentials, getAdminUser, verifyTotp, verifyCaptcha } from "@/server/auth";
import handler from "../../../../pages/api/auth";
import { mockRes, mockReq } from "./__support__/auth-mocks";

beforeEach(() => {
  vi.clearAllMocks();
  isLockedOut.mockResolvedValue(false);
  getFailureCount.mockResolvedValue(0);
  verifyCredentials.mockResolvedValue(false);
  getAdminUser.mockReturnValue(null);
  verifyTotp.mockReturnValue(true);
  verifyCaptcha.mockResolvedValue(true);
});

describe("DELETE /api/auth (logout)", () => {
  it("returns 200 and clears the session cookie", async () => {
    const req = mockReq({ method: "DELETE" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual({ ok: true });
    expect([res._headers["Set-Cookie"]].flat().join(" ")).toContain("Max-Age=0");
  });
});

describe("unsupported methods", () => {
  it("returns 405 for PUT", async () => {
    const req = mockReq({ method: "PUT" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("returns 405 for PATCH", async () => {
    const req = mockReq({ method: "PATCH" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
