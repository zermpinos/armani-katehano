// @ts-nocheck
/**
 * tests/api.coach.auth.test.ts
 * Integration tests for pages/api/coach/auth.ts
 *
 * Mocks: loginAttempts (DB-backed lockout), coachAuth (partial -- keep HMAC
 *   helpers real, override verifyCoachPassword + getCoachSessionVersion),
 *   security (partial -- keep all real, override verifyCaptcha).
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET       = "test-secret-coach-auth";
  process.env.COACH_SESSION_SECRET = "test-coach-secret-coach-auth-xx";
});

vi.mock("@/server/auth", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifyCaptcha:          vi.fn(),
    verifyCoachPassword:    vi.fn(),
    getCoachSessionVersion: vi.fn(),
    isLockedOut:            vi.fn().mockResolvedValue(false),
    recordAttempt:          vi.fn().mockResolvedValue(undefined),
    clearAttempts:          vi.fn().mockResolvedValue(undefined),
    getFailureCount:        vi.fn().mockResolvedValue(0),
  };
});

import { isLockedOut, recordAttempt, clearAttempts, getFailureCount } from "@/server/auth";
import { verifyCaptcha }                                               from "@/server/auth";
import { verifyCoachPassword, getCoachSessionVersion,
         buildCoachSessionCookie }                                     from "@/server/auth";
import handler                                                         from "../../../../pages/api/coach/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {
    statusCode: 200,
    _headers:   {} as Record<string, string>,
    _body:      undefined as unknown,
    setHeader(k: string, v: string) { Reflect.set(res._headers, k, v); return res; },
    status(code: number)            { res.statusCode = code; return res; },
    json(body: unknown)             { res._body = body; return res; },
    end()                           { return res; },
  };
  return res;
}

function mockReq({ method = "GET", headers = {}, body = {}, cookies = {} } = {}) {
  return { method, headers, body, cookies, query: {} };
}

function validCoachCookie(version = 0) {
  const full = buildCoachSessionCookie(JSON.stringify({ ts: Date.now(), role: "coach", v: version }));
  // Extract the bare cookie value from "cookieName=VALUE; HttpOnly; ..."
  return full.split(";")[0].split("=").slice(1).join("=");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  isLockedOut.mockResolvedValue(false);
  getFailureCount.mockResolvedValue(0);
  verifyCoachPassword.mockResolvedValue(false);
  getCoachSessionVersion.mockResolvedValue(0);
  verifyCaptcha.mockResolvedValue(true);
});

describe("GET /api/coach/auth", () => {
  it("returns 200 when a valid coach session cookie is present", async () => {
    const req = mockReq({
      method:  "GET",
      cookies: { "__Host-ak_coach": validCoachCookie(0) },
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

  it("returns 401 when session is expired", async () => {
    const payload = JSON.stringify({ ts: Date.now() - 25 * 60 * 60 * 1000, role: "coach", v: 0 });
    const req = mockReq({
      method:  "GET",
      cookies: { "__Host-ak_coach": buildCoachSessionCookie(payload).split(";")[0].split("=").slice(1).join("=") },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body.error).toMatch(/expired/i);
  });

  it("returns 401 when session version is behind the DB version", async () => {
    getCoachSessionVersion.mockResolvedValue(1);
    const req = mockReq({
      method:  "GET",
      cookies: { "__Host-ak_coach": validCoachCookie(0) },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body.error).toMatch(/revoked/i);
  });
});

describe("POST /api/coach/auth (login)", () => {
  it("returns 403 when CSRF check fails", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com" },
      body:    { password: "secret" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("returns 400 when password is missing", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    {},
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error).toMatch(/password/i);
  });

  it("returns 429 when IP is locked out", async () => {
    isLockedOut.mockResolvedValue(true);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { password: "any" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res._body).toHaveProperty("retryAfter");
  });

  it("returns 429 on per-account lockout even from a different IP", async () => {
    isLockedOut.mockImplementation(async (key) => key === "account_coach");
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com", "x-forwarded-for": "9.9.9.9" },
      body:    { password: "any" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res._body.error).toMatch(/across all clients/i);
  });

  it("returns 401 and records attempt on wrong password", async () => {
    verifyCoachPassword.mockResolvedValue(false);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { password: "wrong" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(recordAttempt).toHaveBeenCalledTimes(2);
    expect(clearAttempts).not.toHaveBeenCalled();
  });

  it("returns 200 and sets coach session cookie on correct password", async () => {
    verifyCoachPassword.mockResolvedValue(true);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { password: "correct" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual({ ok: true });
    const loginCookies = [res._headers["Set-Cookie"]].flat().join(" ");
    expect(loginCookies).toContain("__Host-ak_coach=");
    expect(loginCookies).toContain("HttpOnly");
    expect(clearAttempts).toHaveBeenCalledTimes(2);
    expect(recordAttempt).not.toHaveBeenCalled();
  });

  it("returns 401 with requiresCaptcha when IP has 3+ failures and no captchaToken", async () => {
    getFailureCount.mockResolvedValue(3);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { password: "any" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body).toMatchObject({ requiresCaptcha: true });
    expect(verifyCoachPassword).not.toHaveBeenCalled();
  });

  it("returns 401 and records attempt when captchaToken is invalid", async () => {
    getFailureCount.mockResolvedValue(3);
    verifyCaptcha.mockResolvedValue(false);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { password: "any", captchaToken: "bad-token" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body).toMatchObject({ requiresCaptcha: true });
    expect(recordAttempt).toHaveBeenCalledTimes(2);
    expect(verifyCoachPassword).not.toHaveBeenCalled();
  });

  it("proceeds to credential check when captchaToken is valid and IP has 3+ failures", async () => {
    getFailureCount.mockResolvedValue(3);
    verifyCaptcha.mockResolvedValue(true);
    verifyCoachPassword.mockResolvedValue(false);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { password: "wrong", captchaToken: "valid-token" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(verifyCoachPassword).toHaveBeenCalledOnce();
  });
});

describe("DELETE /api/coach/auth (logout)", () => {
  it("returns 200 and clears the coach session cookie", async () => {
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
});
