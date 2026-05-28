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
    generateRegistrationOpts: vi.fn(),
    verifyRegistrationResp:   vi.fn(),
    issueChallenge:           vi.fn().mockResolvedValue("a".repeat(64)),
    consumeChallenge:         vi.fn(),
  };
});

vi.mock("@/server/db/client", () => ({
  default: {
    passkeyCredential: {
      findMany:  vi.fn().mockResolvedValue([]),
      create:    vi.fn(),
    },
  },
}));

vi.mock("@/server/security/node", () => ({
  auditLog:    vi.fn(),
  getClientIp: vi.fn().mockReturnValue("1.2.3.4"),
}));

// Simulate an authenticated admin session
vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifyPayload: vi.fn().mockReturnValue(
      JSON.stringify({ ts: Date.now(), role: "admin", user: "admin" })
    ),
    getSessionToken: vi.fn().mockReturnValue("valid-token"),
  };
});

import optionsHandler from "../../../../pages/api/auth/passkey/register-options";
import verifyHandler  from "../../../../pages/api/auth/passkey/register-verify";
import { generateRegistrationOpts, verifyRegistrationResp, consumeChallenge } from "@/server/auth/passkey";
import prisma from "@/server/db/client";
import { mockReq, mockRes } from "./__support__/auth-mocks";

beforeEach(() => {
  vi.clearAllMocks();
  (generateRegistrationOpts as any).mockResolvedValue({ challenge: "chal", rp: {} });
  (verifyRegistrationResp as any).mockResolvedValue({
    verified: true,
    registrationInfo: {
      credential: {
        id:        "Y3JlZGVudGlhbElk",
        publicKey: Buffer.from("pubkey"),
        counter:   0,
        transports: ["internal"],
      },
    },
  });
  (consumeChallenge as any).mockResolvedValue("somechallenge");
  (prisma.passkeyCredential.create as any).mockResolvedValue({
    id: "new-id", label: "My MacBook", createdAt: new Date(),
  });
});

describe("POST /api/auth/passkey/register-options", () => {
  it("returns 200 with options and challengeId when authenticated", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com", "x-csrf-token": "tok" },
      cookies: { "__Host-ak_csrf": "tok" },
    });
    const res = mockRes();
    await optionsHandler(req, res);
    expect(res.statusCode).toBe(200);
    const body = res._body as any;
    expect(body).toHaveProperty("options");
    expect(body).toHaveProperty("challengeId");
  });
});

describe("POST /api/auth/passkey/register-verify", () => {
  it("returns 400 when challengeId is malformed", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com", "x-csrf-token": "tok" },
      cookies: { "__Host-ak_csrf": "tok" },
      body:    { challengeId: "short", label: "My Key", response: {} },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when label is empty", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com", "x-csrf-token": "tok" },
      cookies: { "__Host-ak_csrf": "tok" },
      body:    { challengeId: "a".repeat(64), label: "", response: {} },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when label exceeds 100 chars", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com", "x-csrf-token": "tok" },
      cookies: { "__Host-ak_csrf": "tok" },
      body:    { challengeId: "a".repeat(64), label: "x".repeat(101), response: {} },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when challengeId is expired or already consumed", async () => {
    (consumeChallenge as any).mockResolvedValue(null);
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com", "x-csrf-token": "tok" },
      cookies: { "__Host-ak_csrf": "tok" },
      body:    { challengeId: "a".repeat(64), label: "My Key", response: {} },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect((res._body as any).error).toMatch(/expired/i);
  });

  it("returns 409 when credentialId already exists (P2002)", async () => {
    (prisma.passkeyCredential.create as any).mockRejectedValue(
      Object.assign(new Error("Unique constraint"), { code: "P2002" })
    );
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com", "x-csrf-token": "tok" },
      cookies: { "__Host-ak_csrf": "tok" },
      body:    { challengeId: "a".repeat(64), label: "My Key", response: { id: "Y3JlZGVudGlhbElk" } },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(409);
  });

  it("returns 200 with id, label, createdAt on success", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com", "x-csrf-token": "tok" },
      cookies: { "__Host-ak_csrf": "tok" },
      body:    { challengeId: "a".repeat(64), label: "My Key", response: { id: "Y3JlZGVudGlhbElk" } },
    });
    const res = mockRes();
    await verifyHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res._body as any).ok).toBe(true);
    expect((res._body as any).label).toBe("My Key");
  });
});
