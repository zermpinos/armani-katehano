// @ts-nocheck
/**
 * tests/security.test.js
 * Unit tests for lib/security - verifySession, csrfCheck, buildSessionCookie, clearSessionCookie.
 */
import { describe, it, expect, beforeAll } from "vitest";

// Set SESSION_SECRET before the module is imported so signSession / verifySession work.
beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-for-unit-tests";
});

// Dynamic import so the env var is set before module-level code runs.
// We'll use a lazy-import pattern via a helper.
let signSession, verifySession, buildSessionCookie, clearSessionCookie, csrfCheck, SESSION_TTL_S;

beforeAll(async () => {
  const mod = await import("@/server/auth");
  signSession         = mod.signSession;
  verifySession       = mod.verifySession;
  buildSessionCookie  = mod.buildSessionCookie;
  clearSessionCookie  = mod.clearSessionCookie;
  csrfCheck           = mod.csrfCheck;
  SESSION_TTL_S       = mod.SESSION_TTL_S;
});

// ─── verifySession ────────────────────────────────────────────────────────────

describe("verifySession", () => {
  it("round-trips a valid payload", () => {
    const payload = JSON.stringify({ ts: Date.now(), role: "admin" });
    const cookie  = signSession(payload);
    expect(verifySession(cookie)).toBe(payload);
  });

  it("handles payload with dots in it (uses lastIndexOf for split)", () => {
    const payload = "version.1.2.3";
    const cookie  = signSession(payload);
    expect(verifySession(cookie)).toBe(payload);
  });

  it("returns null for empty string", () => {
    expect(verifySession("")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(verifySession(undefined)).toBeNull();
  });

  it("returns null for string with no dot", () => {
    expect(verifySession("nodothere")).toBeNull();
  });

  it("returns null for trailing dot only (empty sig)", () => {
    expect(verifySession("data.")).toBeNull();
  });

  it("returns null for leading dot only (empty data)", () => {
    expect(verifySession(".sig")).toBeNull();
  });

  it("rejects a cookie with tampered payload", () => {
    const good = signSession("test-payload");
    const lastDot = good.lastIndexOf(".");
    const sig     = good.slice(lastDot + 1);
    const tampered = Buffer.from("evil-payload").toString("base64url") + "." + sig;
    expect(verifySession(tampered)).toBeNull();
  });

  it("rejects a cookie with tampered signature", () => {
    const good    = signSession("test-payload");
    const tampered = good.slice(0, -4) + "XXXX";
    expect(verifySession(tampered)).toBeNull();
  });
});

// ─── csrfCheck ────────────────────────────────────────────────────────────────

describe("csrfCheck", () => {
  const req = (method, headers = {}) => ({ method, headers });

  it("allows GET requests unconditionally", () => {
    expect(csrfCheck(req("GET"))).toBe(true);
  });

  it("allows HEAD requests unconditionally", () => {
    expect(csrfCheck(req("HEAD"))).toBe(true);
  });

  it("allows POST when Origin matches Host", () => {
    expect(csrfCheck(req("POST", { host: "example.com", origin: "https://example.com" }))).toBe(true);
  });

  it("rejects POST when Origin mismatches Host", () => {
    expect(csrfCheck(req("POST", { host: "example.com", origin: "https://evil.com" }))).toBe(false);
  });

  it("falls back to Referer when Origin is absent - matches", () => {
    expect(csrfCheck(req("POST", { host: "example.com", referer: "https://example.com/admin" }))).toBe(true);
  });

  it("falls back to Referer when Origin is absent - mismatches", () => {
    expect(csrfCheck(req("POST", { host: "example.com", referer: "https://evil.com/x" }))).toBe(false);
  });

  it("rejects POST with no Origin and no Referer in strict mode", () => {
    expect(csrfCheck(req("POST", { host: "example.com" }), { strict: true })).toBe(false);
  });

  it("allows POST with no Origin and no Referer in default (non-strict) mode", () => {
    // Documents the permissive default - SameSite=Strict cookie is the primary CSRF defence
    expect(csrfCheck(req("POST", { host: "example.com" }))).toBe(true);
  });

  it("rejects POST with malformed Origin URL", () => {
    expect(csrfCheck(req("POST", { host: "example.com", origin: "not-a-url" }))).toBe(false);
  });

  it("rejects DELETE with mismatched Origin", () => {
    expect(csrfCheck(req("DELETE", { host: "example.com", origin: "https://evil.com" }))).toBe(false);
  });
});

// ─── buildSessionCookie / clearSessionCookie ──────────────────────────────────

describe("buildSessionCookie", () => {
  it("includes HttpOnly, Secure, SameSite=Strict, __Host- prefix, and Max-Age", () => {
    const cookie = buildSessionCookie("{}");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("__Host-ak_session=");
    expect(cookie).toContain(`Max-Age=${SESSION_TTL_S}`);
  });

  it("embeds a verifiable session value", () => {
    const payload = JSON.stringify({ role: "admin" });
    const cookie  = buildSessionCookie(payload);
    // Extract the value part (everything after "__Host-ak_session=" up to ";")
    const value   = cookie.split(";")[0].split("=").slice(1).join("=");
    expect(verifySession(value)).toBe(payload);
  });
});

describe("clearSessionCookie", () => {
  it("sets Max-Age=0", () => {
    const cookie = clearSessionCookie();
    expect(cookie).toContain("Max-Age=0");
  });

  it("uses the correct __Host- cookie name", () => {
    const cookie = clearSessionCookie();
    expect(cookie).toContain("__Host-ak_session=");
  });
});
