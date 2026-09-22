// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-admin-integration";
});

const { mockPrisma } = vi.hoisted(() => {
  const mp = {
    game: {
      findMany:          vi.fn(),
      create:            vi.fn(),
      update:            vi.fn(),
      delete:            vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    playerGameStat: { createMany: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    $transaction: vi.fn(),
  };
  mp.$transaction.mockImplementation(async (fn) => fn(mp));
  return { mockPrisma: mp };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/services/stats-recalc", () => ({
  recalcAggregates: vi.fn().mockResolvedValue(undefined),
}));

import { signSession, generateCsrfToken, SESSION_TTL_S } from "@/server/auth";
import { recalcAggregates } from "@/server/services/stats-recalc";
import handler from "../../../../pages/api/admin/games";
import {
  mockRes, mockReq, authedReq, authCookie,
  VALID_GAME_BODY, setupMocks,
} from "./__support__/games-admin-mocks";

beforeEach(() => setupMocks(mockPrisma, recalcAggregates));

describe("requireAuth middleware", () => {
  it("returns 401 with no session cookie", async () => {
    const req = mockReq({ method: "GET" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body.error).toMatch(/unauthorized/i);
  });

  it("returns 401 with a malformed session cookie", async () => {
    const req = mockReq({
      method:  "GET",
      cookies: { "__Host-ak_session": "garbage.value" },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with an expired session (ts > SESSION_TTL_S ago)", async () => {
    const old = JSON.stringify({ ts: Date.now() - (SESSION_TTL_S + 60) * 1000, role: "admin" });
    const req = mockReq({
      method:  "GET",
      cookies: { "__Host-ak_session": signSession(old) },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._body.error).toMatch(/expired/i);
  });

  it("returns 200 with a session 1 second inside the TTL boundary", async () => {
    const fresh = JSON.stringify({ ts: Date.now() - (SESSION_TTL_S - 1) * 1000, role: "admin" });
    const req = mockReq({
      method:  "GET",
      cookies: { "__Host-ak_session": signSession(fresh) },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("returns 403 when the Origin is not the configured one", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://evil.com" },
      cookies: { "__Host-ak_session": authCookie() },
      body:    VALID_GAME_BODY,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 when the CSRF token was minted for a different session", async () => {
    const foreign = generateCsrfToken(signSession(JSON.stringify({ ts: Date.now() - 1000, role: "admin" })));
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://example.com", "x-csrf-token": foreign },
      cookies: { "__Host-ak_session": authCookie(), "__Host-ak_csrf": foreign },
      body:    VALID_GAME_BODY,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  // csrf_blocked used to fire for every bot probe and CI run, which is what
  // paged the channel. The session check now runs first.
  it("does not raise csrf_blocked for a request with no session", async () => {
    const req = mockReq({ method: "POST", headers: { host: "example.com" }, body: VALID_GAME_BODY });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    const events = mockPrisma.auditLog.create.mock.calls.map(([arg]) => arg.data.event);
    expect(events).not.toContain("csrf_blocked");
  });

  it("raises csrf_blocked for a valid session arriving from another origin", async () => {
    const req = mockReq({
      method:  "POST",
      headers: { host: "example.com", origin: "https://evil.com" },
      cookies: { "__Host-ak_session": authCookie() },
      body:    VALID_GAME_BODY,
    });
    const res = mockRes();
    await handler(req, res);
    const events = mockPrisma.auditLog.create.mock.calls.map(([arg]) => arg.data.event);
    expect(events).toContain("csrf_blocked");
  });
});
