// @ts-nocheck
/**
 * tests/api.coach.revocation.test.ts
 * Verifies that coach sessions are invalidated after a password change
 * by checking the session version embedded in the cookie against the
 * current DB version.
 *
 * Mocks: lib/prisma (unused — version is mocked directly), lib/coachAuth
 *   (partial — only getCoachSessionVersion overridden so HMAC helpers remain real).
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-coach-revocation";
});

vi.mock("../lib/prisma", () => ({ default: {} }));

vi.mock("../lib/coachAuth", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getCoachSessionVersion: vi.fn() };
});

import { signSession }             from "../lib/security";
import { getCoachSessionVersion }  from "../lib/coachAuth";
import { requireCoachAuth }        from "../lib/requireCoachAuth";

// Minimal handler protected by requireCoachAuth
const protectedHandler = requireCoachAuth(async (_req, res) => {
  res.status(200).json({ ok: true });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {
    statusCode: 200,
    _headers:   {},
    _body:      undefined,
    setHeader(k: string, v: string) { res._headers[k] = v; return res; },
    status(code: number)            { res.statusCode = code; return res; },
    json(body: unknown)             { res._body = body; return res; },
    end()                           { return res; },
  };
  return res;
}

// Use GET so the CSRF check is skipped (GET is exempt), keeping tests focused
// on the session-version logic only.
function coachReq(coachCookie: string) {
  return {
    method:  "GET",
    headers: { host: "example.com" },
    cookies: { "__Host-ak_coach": coachCookie },
    query:   {},
    url:     "/api/coach/test",
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("coach session-version revocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 'Session revoked' when cookie version is behind the current DB version", async () => {
    getCoachSessionVersion.mockResolvedValue(1);
    const stale = signSession(JSON.stringify({ ts: Date.now(), role: "coach", v: 0 }));
    const res = mockRes();
    await protectedHandler(coachReq(stale), res);
    expect(res.statusCode).toBe(401);
    expect(res._body.error).toMatch(/revoked/i);
  });

  it("returns 200 when session version matches the current DB version", async () => {
    getCoachSessionVersion.mockResolvedValue(2);
    const current = signSession(JSON.stringify({ ts: Date.now(), role: "coach", v: 2 }));
    const res = mockRes();
    await protectedHandler(coachReq(current), res);
    expect(res.statusCode).toBe(200);
    expect(res._body.ok).toBe(true);
  });

  it("treats a legacy session (no v field, defaults to 0) as revoked when DB version > 0", async () => {
    getCoachSessionVersion.mockResolvedValue(1);
    // Session issued before the version field was introduced
    const legacy = signSession(JSON.stringify({ ts: Date.now(), role: "coach" }));
    const res = mockRes();
    await protectedHandler(coachReq(legacy), res);
    expect(res.statusCode).toBe(401);
    expect(res._body.error).toMatch(/revoked/i);
  });

  it("accepts a legacy session (no v) when DB version is still 0 (no password change yet)", async () => {
    getCoachSessionVersion.mockResolvedValue(0);
    const legacy = signSession(JSON.stringify({ ts: Date.now(), role: "coach" }));
    const res = mockRes();
    await protectedHandler(coachReq(legacy), res);
    expect(res.statusCode).toBe(200);
  });
});
