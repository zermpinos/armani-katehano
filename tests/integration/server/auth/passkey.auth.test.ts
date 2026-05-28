// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-session-secret-32bytes-xxxx";
  process.env.APP_URL        = "https://example.com";
  process.env.NODE_ENV       = "test";
});

vi.mock("@/server/auth/passkey", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateAuthOpts:  vi.fn(),
    issueChallenge:    vi.fn(),
    consumeChallenge:  vi.fn(),
    verifyAuthResp:    vi.fn(),
    generateChallengeId: vi.fn().mockReturnValue("a".repeat(64)),
  };
});

vi.mock("@/server/db/client", () => ({
  default: {
    passkeyCredential: {
      findUnique: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@/server/auth/login-attempts", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    atomicRecordAndCheck: vi.fn().mockResolvedValue({ locked: false, count: 1 }),
  };
});

vi.mock("@/server/security/node", () => ({
  auditLog:    vi.fn(),
  getClientIp: vi.fn().mockReturnValue("1.2.3.4"),
}));

import { generateAuthOpts, issueChallenge } from "@/server/auth/passkey";
import { atomicRecordAndCheck }             from "@/server/auth/login-attempts";
import handler from "../../../../pages/api/auth/passkey/auth-options";
import { mockReq, mockRes }                 from "./__support__/auth-mocks";

beforeEach(() => {
  vi.clearAllMocks();
  atomicRecordAndCheck.mockResolvedValue({ locked: false, count: 1 });
  (generateAuthOpts as any).mockResolvedValue({ challenge: "testchallenge", rpId: "example.com" });
  (issueChallenge as any).mockResolvedValue("a".repeat(64));
});

describe("POST /api/auth/passkey/auth-options", () => {
  it("returns 405 for non-POST", async () => {
    const req = mockReq({ method: "GET" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("returns 429 when rate limit exceeded", async () => {
    atomicRecordAndCheck.mockResolvedValue({ locked: true, count: 31 });
    const req = mockReq({ method: "POST", headers: { host: "example.com" } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
  });

  it("returns options and challengeId on success", async () => {
    const req = mockReq({ method: "POST", headers: { host: "example.com" } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = res._body as any;
    expect(body).toHaveProperty("options");
    expect(body).toHaveProperty("challengeId");
    expect(typeof body.challengeId).toBe("string");
    expect(body.challengeId).toHaveLength(64);
  });

  it("calls atomicRecordAndCheck with passkey-specific key, not the raw IP key", async () => {
    const req = mockReq({ method: "POST", headers: { host: "example.com" } });
    const res = mockRes();
    await handler(req, res);
    expect(atomicRecordAndCheck).toHaveBeenCalledWith(
      expect.stringContaining("pk:"),
      30,
      60
    );
  });
});
import verifyHandler from "../../../../pages/api/auth/passkey/auth-verify";
import prisma        from "@/server/db/client";
import { consumeChallenge, verifyAuthResp } from "@/server/auth/passkey";
import { getAdminUser } from "@/server/auth/password";

vi.mock("@/server/auth/password", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getAdminUser: vi.fn() };
});

const fakeCredential = {
  id:           "cred-row-id",
  credentialId: "Y3JlZGVudGlhbElk",
  publicKey:    Buffer.from("fakepubkey"),
  counter:      0,
  transports:   ["internal"],
  username:     "admin",
};

describe("POST /api/auth/passkey/auth-verify", () => {
  beforeEach(() => {
    (consumeChallenge as any).mockResolvedValue("base64urlchallenge");
    (prisma.passkeyCredential.findUnique as any).mockResolvedValue(fakeCredential);
    (getAdminUser as any).mockReturnValue({ username: "admin", passwordHash: "$2b$12$x" });
    (verifyAuthResp as any).mockResolvedValue({
      verified:           true,
      authenticationInfo: { newCounter: 1 },
    });
    (prisma.$executeRaw as any).mockResolvedValue(1);
  });

  it("returns 405 for non-POST", async () => {
    const req = mockReq({ method: "GET" });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("returns 401 for malformed challengeId (not 64 hex chars)", async () => {
    const req = mockReq({
      method: "POST",
      body:   { challengeId: "short", response: { id: "Y3JlZGVudGlhbElk" } },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(consumeChallenge).not.toHaveBeenCalled();
  });

  it("returns 401 for malformed response.id (invalid base64url chars)", async () => {
    const req = mockReq({
      method: "POST",
      body:   { challengeId: "a".repeat(64), response: { id: "not valid!!!" } },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(consumeChallenge).not.toHaveBeenCalled();
  });

  it("returns 401 when challenge is expired or consumed (consumeChallenge returns null)", async () => {
    (consumeChallenge as any).mockResolvedValue(null);
    const req = mockReq({
      method: "POST",
      body:   { challengeId: "a".repeat(64), response: { id: "Y3JlZGVudGlhbElk" } },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body).toEqual({ error: "Authentication failed" });
  });

  it("returns same 401 error message when credential not found as when challenge expired", async () => {
    (prisma.passkeyCredential.findUnique as any).mockResolvedValue(null);
    const req = mockReq({
      method: "POST",
      body:   { challengeId: "a".repeat(64), response: { id: "Y3JlZGVudGlhbElk" } },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body).toEqual({ error: "Authentication failed" });
  });

  it("returns 401 when credential username is not in ADMIN_USERS", async () => {
    (getAdminUser as any).mockReturnValue(null);
    const req = mockReq({
      method: "POST",
      body:   { challengeId: "a".repeat(64), response: { id: "Y3JlZGVudGlhbElk" } },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body).toEqual({ error: "Authentication failed" });
  });

  it("returns 401 when verifyAuthResp fails", async () => {
    (verifyAuthResp as any).mockResolvedValue({ verified: false });
    const req = mockReq({
      method: "POST",
      body:   { challengeId: "a".repeat(64), response: { id: "Y3JlZGVudGlhbElk" } },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body).toEqual({ error: "Authentication failed" });
  });

  it("returns 401 and emits passkey_clone_suspected when counter update affects 0 rows", async () => {
    (prisma.$executeRaw as any).mockResolvedValue(0);
    const req = mockReq({
      method: "POST",
      body:   { challengeId: "a".repeat(64), response: { id: "Y3JlZGVudGlhbElk" } },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(401);
    const { auditLog } = await import("@/server/security/node");
    expect(auditLog).toHaveBeenCalledWith("passkey_clone_suspected", expect.any(Object));
  });

  it("sets session and CSRF cookies on success and returns ok: true", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com" },
      body:    { challengeId: "a".repeat(64), response: { id: "Y3JlZGVudGlhbElk" } },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res._body as any).ok).toBe(true);
    expect(res._headers["Set-Cookie"]).toBeDefined();
  });

  it("replay test: verify does not expose different data for no-credential vs expired-challenge", async () => {
    (consumeChallenge as any).mockResolvedValue(null);
    const req1 = mockReq({ method: "POST", body: { challengeId: "a".repeat(64), response: { id: "Y3JlZGVudGlhbElk" } } });
    const res1 = mockRes();
    await verifyHandler(req1, res1);

    (consumeChallenge as any).mockResolvedValue("somechallenge");
    (prisma.passkeyCredential.findUnique as any).mockResolvedValue(null);
    const req2 = mockReq({ method: "POST", body: { challengeId: "a".repeat(64), response: { id: "Y3JlZGVudGlhbElk" } } });
    const res2 = mockRes();
    await verifyHandler(req2, res2);

    expect(res1.statusCode).toBe(res2.statusCode);
    expect(res1._body).toEqual(res2._body);
  });
});
