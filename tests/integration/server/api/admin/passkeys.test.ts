// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-session-secret-32bytes-xxxx";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  process.env.NODE_ENV       = "test";
});

vi.mock("@/server/db/client", () => ({
  default: {
    passkeyCredential: {
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      delete:     vi.fn(),
    },
  },
}));

vi.mock("@/server/security/node", () => ({
  auditLog:    vi.fn(),
  getClientIp: vi.fn().mockReturnValue("1.2.3.4"),
}));

vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifyPayload:   vi.fn().mockReturnValue(JSON.stringify({ ts: Date.now(), role: "admin", user: "admin" })),
    getSessionToken: vi.fn().mockReturnValue("valid-token"),
  };
});

import handler from "../../../../../pages/api/admin/passkeys";
import prisma   from "@/server/db/client";
import { mockReq, mockRes } from "../../auth/__support__/auth-mocks";

const authHeaders = {
  host:            "example.com",
  origin:          "https://example.com",
  "x-csrf-token":  "tok",
};
const authCookies = { "__Host-ak_csrf": "tok" };

const fakeRow = {
  id:          "row-1",
  label:       "My MacBook",
  createdAt:   new Date("2026-01-01"),
  lastUsedAt:  null,
  transports:  ["internal"],
  username:    "admin",
};

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.passkeyCredential.findMany as any).mockResolvedValue([fakeRow]);
  (prisma.passkeyCredential.findUnique as any).mockResolvedValue(fakeRow);
  (prisma.passkeyCredential.delete as any).mockResolvedValue(fakeRow);
});

describe("GET /api/admin/passkeys", () => {
  it("returns credential list without publicKey or counter", async () => {
    const req = mockReq({ method: "GET", headers: authHeaders, cookies: authCookies });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = res._body as any[];
    expect(body).toHaveLength(1);
    expect(body[0]).not.toHaveProperty("publicKey");
    expect(body[0]).not.toHaveProperty("counter");
    expect(body[0]).not.toHaveProperty("credentialId");
    expect(body[0]).toHaveProperty("id");
    expect(body[0]).toHaveProperty("label");
  });
});

describe("DELETE /api/admin/passkeys", () => {
  it("deletes own credential and returns ok", async () => {
    const req = mockReq({
      method:  "DELETE",
      headers: authHeaders,
      cookies: authCookies,
      body:    { id: "row-1" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res._body as any).ok).toBe(true);
    expect(prisma.passkeyCredential.delete).toHaveBeenCalled();
  });

  it("returns 404 when credential belongs to a different admin (no ownership leak)", async () => {
    (prisma.passkeyCredential.findUnique as any).mockResolvedValue({
      ...fakeRow, username: "other-admin",
    });
    const req = mockReq({
      method:  "DELETE",
      headers: authHeaders,
      cookies: authCookies,
      body:    { id: "row-1" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(prisma.passkeyCredential.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when credential id is not found", async () => {
    (prisma.passkeyCredential.findUnique as any).mockResolvedValue(null);
    const req = mockReq({
      method:  "DELETE",
      headers: authHeaders,
      cookies: authCookies,
      body:    { id: "nonexistent" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });
});
