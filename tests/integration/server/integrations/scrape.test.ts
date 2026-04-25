// @ts-nocheck
/**
 * tests/api.scrape.test.ts
 * SSRF-guard tests for pages/api/admin/scrape.ts.
 *
 * Mocks: requireAuth (bypass), dns.promises.lookup, boxscore-scraper.
 * Verifies that the IP-allowlist check fires after DNS resolution so a
 * DNS-rebinding attack (allowed hostname -> private IP) is blocked.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-scrape";
});

vi.mock("@/server/auth", () => ({
  requireAuth: (fn: any) => fn,
}));

const { mockLookup } = vi.hoisted(() => {
  const lookup = vi.fn();
  return { mockLookup: lookup };
});

vi.mock("dns", () => ({
  default: { promises: { lookup: mockLookup } },
}));

vi.mock("@/server/integrations/scraper/boxscore", () => ({
  scrapeGame: vi.fn(),
}));

import handler from "../../../../pages/api/admin/scrape";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {
    statusCode: 200,
    _headers:   {},
    _body:      undefined,
    setHeader(k: string, v: string) { Reflect.set(res._headers, k, v); return res; },
    status(code: number)            { res.statusCode = code; return res; },
    json(body: unknown)             { res._body = body; return res; },
    end()                           { return res; },
  };
  return res;
}

function postReq(body = {}) {
  return {
    method:  "POST",
    headers: { host: "example.com", origin: "https://example.com" },
    body,
    cookies: {},
    query:   {},
  };
}

// ─── SSRF guard ───────────────────────────────────────────────────────────────

describe("SSRF guard -- /api/admin/scrape", () => {
  beforeEach(() => vi.clearAllMocks());

  // DNS rebinding: hostname passes the allowlist but DNS resolves to a private IP
  it("returns 400 when an allowed hostname resolves to RFC 1918 private IPv4 (rebinding)", async () => {
    mockLookup.mockResolvedValue({ address: "192.168.1.1", family: 4 });
    const res = mockRes();
    await handler(postReq({ url: "https://basketcity.sportstats.gr/game/123" }), res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error).toMatch(/not allowed/i);
  });

  it("returns 400 when an allowed hostname resolves to loopback IPv6 (::1)", async () => {
    mockLookup.mockResolvedValue({ address: "::1", family: 6 });
    const res = mockRes();
    await handler(postReq({ url: "https://basketcity.sportstats.gr/game/123" }), res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error).toMatch(/not allowed/i);
  });

  it("returns 400 when an allowed hostname resolves to cloud metadata endpoint (169.254.169.254)", async () => {
    mockLookup.mockResolvedValue({ address: "169.254.169.254", family: 4 });
    const res = mockRes();
    await handler(postReq({ url: "https://basketaki.com/game/456" }), res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error).toMatch(/not allowed/i);
  });

  it("returns 400 when an allowed hostname resolves to 10.x.x.x (RFC 1918)", async () => {
    mockLookup.mockResolvedValue({ address: "10.0.0.1", family: 4 });
    const res = mockRes();
    await handler(postReq({ url: "https://basketcity.sportstats.gr/game/789" }), res);
    expect(res.statusCode).toBe(400);
  });

  // Allowlist check -- DNS lookup must not be reached for non-allowed hostnames
  it("returns 400 for a non-allowlisted hostname and never calls DNS", async () => {
    const res = mockRes();
    await handler(postReq({ url: "https://evil.example.com/path" }), res);
    expect(res.statusCode).toBe(400);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("returns 400 for a file:// URL (protocol check)", async () => {
    const res = mockRes();
    await handler(postReq({ url: "file:///etc/passwd" }), res);
    expect(res.statusCode).toBe(400);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid URL body", async () => {
    const res = mockRes();
    await handler(postReq({ url: "not-a-url" }), res);
    expect(res.statusCode).toBe(400);
    expect(mockLookup).not.toHaveBeenCalled();
  });
});
