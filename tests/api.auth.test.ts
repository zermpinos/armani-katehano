// @ts-nocheck
/**
 * tests/api.auth.test.js
 * Integration tests for pages/api/auth.js
 *
 * Mocks: loginAttempts (DB-backed lockout), verifyPassword (bcrypt -- too slow for tests).
 * All other security functions (CSRF check, session signing, cookie building) are real.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

// Set SESSION_SECRET before any module loads so security.js captures it.
vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-auth-integration";
});

// Mock loginAttempts -- it hits Prisma which we don't want in unit/integration tests.
vi.mock("../lib/loginAttempts.js", () => ({
  isLockedOut:   vi.fn().mockResolvedValue(false),
  recordAttempt: vi.fn().mockResolvedValue(undefined),
  clearAttempts: vi.fn().mockResolvedValue(undefined),
}));

// Partially mock security.js: keep all real implementations, override verifyPassword only.
vi.mock("../lib/security", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, verifyPassword: vi.fn() };
});

import { isLockedOut, recordAttempt, clearAttempts } from "../lib/loginAttempts";
import { verifyPassword, signSession }                from "../lib/security";
import handler                                         from "../pages/api/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {
    statusCode: 200,
    _headers:   {},
    _body:      undefined,
    setHeader(k, v) { res._headers[k] = v; return res; },
    status(code)    { res.statusCode = code; return res; },
    json(body)      { res._body = body; return res; },
    end()           { return res; },
  };
  return res;
}

function mockReq({ method = "GET", headers = {}, body = {}, cookies = {} } = {}) {
  return { method, headers, body, cookies, query: {} };
}

function validSessionCookie() {
  return signSession(JSON.stringify({ ts: Date.now(), role: "admin" }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  isLockedOut.mockResolvedValue(false);
  verifyPassword.mockResolvedValue(false);
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

describe("POST /api/auth (login)", () => {
  it("returns 403 when CSRF check fails (strict mode -- no Origin/Referer)", async () => {
    // strict=true means no Origin and no Referer -> rejected
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

  it("returns 400 when password is not a string", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { password: 123 },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
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

  it("returns 401 and records attempt on wrong password", async () => {
    verifyPassword.mockResolvedValue(false);
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

  it("returns 200 and sets session cookie on correct password", async () => {
    verifyPassword.mockResolvedValue(true);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { password: "correct" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual({ ok: true });
    expect(res._headers["Set-Cookie"]).toContain("__Host-ak_session=");
    expect(res._headers["Set-Cookie"]).toContain("HttpOnly");
    expect(clearAttempts).toHaveBeenCalledTimes(2);
    expect(recordAttempt).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/auth (logout)", () => {
  it("returns 200 and clears the session cookie", async () => {
    const req = mockReq({ method: "DELETE" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual({ ok: true });
    expect(res._headers["Set-Cookie"]).toContain("Max-Age=0");
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
