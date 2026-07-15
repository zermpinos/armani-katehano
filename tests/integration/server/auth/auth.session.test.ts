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

import { isLockedOut, getFailureCount, verifyCredentials, getAdminUser, verifyTotp, verifyCaptcha, signSession, SESSION_TTL_S } from "@/server/auth";
import handler from "../../../../pages/api/auth";
import { mockRes, mockReq } from "./__support__/auth-mocks";

function sessionCookie(payload: Record<string, unknown>) {
  return signSession(JSON.stringify(payload));
}

function validSessionCookie() {
  return sessionCookie({ ts: Date.now(), role: "admin" });
}

async function getWithCookie(cookie: string) {
  const req = mockReq({ method: "GET", cookies: { "__Host-ak_session": cookie } });
  const res = mockRes();
  await handler(req, res);
  return res;
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

  it("returns 401 when the payload is signed but expired", async () => {
    const res = await getWithCookie(
      sessionCookie({ ts: Date.now() - (SESSION_TTL_S * 1000 + 1000), role: "admin" }),
    );
    expect(res.statusCode).toBe(401);
  });

  it("returns 200 when the payload is inside the TTL window", async () => {
    const res = await getWithCookie(
      sessionCookie({ ts: Date.now() - (SESSION_TTL_S * 1000 - 60_000), role: "admin" }),
    );
    expect(res.statusCode).toBe(200);
  });

  it("returns 401 when the payload role is not admin", async () => {
    const res = await getWithCookie(sessionCookie({ ts: Date.now(), role: "coach" }));
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when the payload has no role", async () => {
    const res = await getWithCookie(sessionCookie({ ts: Date.now() }));
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when the payload has no ts", async () => {
    const res = await getWithCookie(sessionCookie({ role: "admin" }));
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when the payload is signed but not JSON", async () => {
    const res = await getWithCookie(signSession("not-json"));
    expect(res.statusCode).toBe(401);
  });
});
