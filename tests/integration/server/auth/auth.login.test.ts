// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-auth-integration";
});

vi.mock("@/server/auth", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifyCredentials:    vi.fn(),
    getAdminUser:         vi.fn(),
    verifyTotp:           vi.fn(),
    verifyCaptcha:        vi.fn(),
    isLockedOut:          vi.fn().mockResolvedValue(false),
    atomicRecordAndCheck: vi.fn().mockResolvedValue({ locked: false, count: 1 }),
    clearAttempts:        vi.fn().mockResolvedValue(undefined),
    getFailureCount:      vi.fn().mockResolvedValue(0),
  };
});

vi.mock("@/server/security/node", () => ({
  auditLog:    vi.fn(),
  getClientIp: vi.fn().mockReturnValue("1.2.3.4"),
}));

import { isLockedOut, atomicRecordAndCheck, clearAttempts, getFailureCount, verifyCredentials, getAdminUser, verifyTotp, verifyCaptcha } from "@/server/auth";
import handler from "../../../../pages/api/auth";
import { mockRes, mockReq } from "./__support__/auth-mocks";
import { auditLog } from "@/server/security/node";

const ADMIN_SLUG     = "test-admin-slug";
const FALLBACK_TOKEN = "test-fallback-token";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_SLUG             = ADMIN_SLUG;
  process.env.PASSKEY_FALLBACK_TOKEN = FALLBACK_TOKEN;
  isLockedOut.mockResolvedValue(false);
  atomicRecordAndCheck.mockResolvedValue({ locked: false, count: 1 });
  getFailureCount.mockResolvedValue(0);
  verifyCredentials.mockResolvedValue(false);
  getAdminUser.mockReturnValue(null);
  verifyTotp.mockReturnValue(true);
  verifyCaptcha.mockResolvedValue(true);
});

function loginReq(body: Record<string, unknown>) {
  return mockReq({
    method:  "POST",
    headers: { host: "example.com", origin: "https://example.com" },
    body,
  });
}

describe("POST /api/auth (fallback gate)", () => {
  it("returns 404 with valid credentials when PASSKEY_FALLBACK_TOKEN is unset", async () => {
    delete process.env.PASSKEY_FALLBACK_TOKEN;
    verifyCredentials.mockResolvedValue(true);
    getAdminUser.mockReturnValue({ username: "admin", passwordHash: "$2b$..." });
    const req = loginReq({ username: "admin", password: "correct", slug: ADMIN_SLUG });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(verifyCredentials).not.toHaveBeenCalled();
    expect(res._headers["Set-Cookie"]).toBeUndefined();
  });

  it("returns 404 with valid credentials when PASSKEY_FALLBACK_TOKEN is empty", async () => {
    process.env.PASSKEY_FALLBACK_TOKEN = "";
    verifyCredentials.mockResolvedValue(true);
    const req = loginReq({ username: "admin", password: "correct", slug: ADMIN_SLUG });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(verifyCredentials).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth (slug validation)", () => {
  it("returns 404 when the slug does not match ADMIN_SLUG", async () => {
    verifyCredentials.mockResolvedValue(true);
    const req = loginReq({ username: "admin", password: "correct", slug: "wrong-slug" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(verifyCredentials).not.toHaveBeenCalled();
    expect(res._headers["Set-Cookie"]).toBeUndefined();
  });

  it("returns 404 when the slug is missing", async () => {
    verifyCredentials.mockResolvedValue(true);
    const req = loginReq({ username: "admin", password: "correct" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(verifyCredentials).not.toHaveBeenCalled();
  });

  it("rejects a wrong slug before recording a lockout attempt", async () => {
    const req = loginReq({ username: "admin", password: "correct", slug: "wrong-slug" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(isLockedOut).not.toHaveBeenCalled();
    expect(atomicRecordAndCheck).not.toHaveBeenCalled();
  });

  it("logs the real slug result on success rather than a hardcoded true", async () => {
    verifyCredentials.mockResolvedValue(true);
    getAdminUser.mockReturnValue({ username: "admin", passwordHash: "$2b$..." });
    const req = loginReq({ username: "admin", password: "correct", slug: ADMIN_SLUG });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(auditLog).toHaveBeenCalledWith("login_success", expect.objectContaining({ slugValid: true, username: "admin" }));
  });
});

describe("POST /api/auth (login)", () => {
  it("returns 403 when CSRF check fails (strict mode - no Origin/Referer)", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com" },
      body:    { username: "admin", password: "secret" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("returns 400 when username is missing", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { password: "secret" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error).toMatch(/username/i);
  });

  it("returns 400 when password is missing", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin" },
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
      body:    { username: "admin", password: 123 },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 429 on per-account lockout even from a previously unseen IP", async () => {
    // IP check passes (false); account key "account_admin" triggers lockout (true)
    isLockedOut.mockImplementation(async (key) => key === "account_admin");
    const req = mockReq({
      method:  "POST",
      headers: {
        host:              "example.com",
        origin:            "https://example.com",
        "x-forwarded-for": "5.6.7.8",
      },
      body: { username: "admin", password: "any", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res._body.error).toMatch(/across all clients/i);
  });

  it("returns 429 when IP is locked out", async () => {
    isLockedOut.mockResolvedValue(true);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "any", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res._body).toHaveProperty("retryAfter");
  });

  it("returns 401 and records attempt on wrong credentials", async () => {
    verifyCredentials.mockResolvedValue(false);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "wrong", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(atomicRecordAndCheck).toHaveBeenCalledTimes(2);
    expect(clearAttempts).not.toHaveBeenCalled();
  });

  it("returns 200 and sets session cookie on correct credentials (no TOTP configured)", async () => {
    verifyCredentials.mockResolvedValue(true);
    getAdminUser.mockReturnValue({ username: "admin", passwordHash: "$2b$..." });
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "correct", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual({ ok: true });
    const loginCookies = [res._headers["Set-Cookie"]].flat().join(" ");
    expect(loginCookies).toContain("__Host-ak_session=");
    expect(loginCookies).toContain("HttpOnly");
    expect(clearAttempts).toHaveBeenCalledTimes(2);
    expect(atomicRecordAndCheck).not.toHaveBeenCalled();
  });

  it("returns 401 when TOTP is configured but code is missing", async () => {
    verifyCredentials.mockResolvedValue(true);
    getAdminUser.mockReturnValue({ username: "admin", passwordHash: "$2b$...", totpSecret: "BASE32SECRET" });
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "correct", slug: ADMIN_SLUG }, // no totpToken
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body.error).toMatch(/authenticator/i);
  });

  it("returns 401 when TOTP code is wrong", async () => {
    verifyCredentials.mockResolvedValue(true);
    getAdminUser.mockReturnValue({ username: "admin", passwordHash: "$2b$...", totpSecret: "BASE32SECRET" });
    verifyTotp.mockReturnValue(false);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "correct", totpToken: "000000", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body.error).toMatch(/authenticator/i);
  });

  it("returns 200 when credentials and TOTP are both correct", async () => {
    verifyCredentials.mockResolvedValue(true);
    getAdminUser.mockReturnValue({ username: "admin", passwordHash: "$2b$...", totpSecret: "BASE32SECRET" });
    verifyTotp.mockReturnValue(true);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "correct", totpToken: "123456", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual({ ok: true });
    expect(clearAttempts).toHaveBeenCalledTimes(2);
  });

  it("returns 401 with requiresCaptcha when IP has 3+ failures and no captchaToken", async () => {
    getFailureCount.mockResolvedValue(3);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "any", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body).toMatchObject({ requiresCaptcha: true });
    expect(verifyCredentials).not.toHaveBeenCalled();
  });

  it("returns 401 and records attempt when captchaToken is invalid", async () => {
    getFailureCount.mockResolvedValue(3);
    verifyCaptcha.mockResolvedValue(false);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "any", captchaToken: "bad-token", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body).toMatchObject({ requiresCaptcha: true });
    expect(atomicRecordAndCheck).toHaveBeenCalledTimes(2);
    expect(verifyCredentials).not.toHaveBeenCalled();
  });

  it("proceeds to credential check when captchaToken is valid and IP has 3+ failures", async () => {
    getFailureCount.mockResolvedValue(3);
    verifyCaptcha.mockResolvedValue(true);
    verifyCredentials.mockResolvedValue(false);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "wrong", captchaToken: "valid-token", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(verifyCredentials).toHaveBeenCalledOnce();
  });

  it("returns 429 when IP lockout is triggered on credential failure - emits login_locked audit event", async () => {
    verifyCredentials.mockResolvedValue(false);
    atomicRecordAndCheck.mockImplementation(async (key: string) =>
      key.startsWith("account_")
        ? { locked: false, count: 1 }
        : { locked: true, count: 5 },
    );
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "wrong", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res._body.retryAfter).toBe(900);
    expect(auditLog).toHaveBeenCalledWith("login_locked", expect.objectContaining({ ip: expect.any(String) }));
  });

  it("returns 429 when account lockout is triggered on credential failure - emits login_account_locked audit event", async () => {
    verifyCredentials.mockResolvedValue(false);
    atomicRecordAndCheck.mockImplementation(async (key: string) =>
      key.startsWith("account_")
        ? { locked: true, count: 25 }
        : { locked: false, count: 1 },
    );
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "wrong", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res._body.retryAfter).toBe(3600);
    expect(res._body.error).toMatch(/across all clients/i);
    expect(auditLog).toHaveBeenCalledWith("login_account_locked", expect.objectContaining({ ip: expect.any(String) }));
  });

  it("returns 429 when IP lockout is triggered on TOTP failure", async () => {
    verifyCredentials.mockResolvedValue(true);
    getAdminUser.mockReturnValue({ username: "admin", passwordHash: "$2b$...", totpSecret: "BASE32" });
    verifyTotp.mockReturnValue(false);
    atomicRecordAndCheck.mockResolvedValue({ locked: true, count: 5 });
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "correct", totpToken: "000000", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
  });

  it("429 body does not expose the attempt count", async () => {
    verifyCredentials.mockResolvedValue(false);
    atomicRecordAndCheck.mockResolvedValue({ locked: true, count: 5 });
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com" },
      body:    { username: "admin", password: "wrong", slug: ADMIN_SLUG },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(JSON.stringify(res._body)).not.toContain("count");
    expect(JSON.stringify(res._body)).not.toContain("5");
  });
});
