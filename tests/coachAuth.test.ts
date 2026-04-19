// @ts-nocheck
/**
 * tests/coachAuth.test.ts
 * Unit tests for lib/coachAuth — HMAC sign/verify helpers, cookie builders,
 * and isValidCoachToken.
 *
 * Prisma is mocked so no DB connection is required.
 */
import { vi, describe, it, expect, beforeAll } from "vitest";

vi.mock("../lib/prisma", () => ({
  default: {
    setting: {
      findUnique: vi.fn(),
      upsert:     vi.fn(),
    },
  },
}));

vi.hoisted(() => {
  process.env.COACH_SESSION_SECRET = "test-coach-secret-32-bytes-xxxxx";
  process.env.SESSION_SECRET       = "test-admin-secret-32-bytes-xxxxx";
  process.env.COACH_TOKEN          = "correct-coach-token";
});

let verifyCoachSession: (v: string) => string | null;
let buildCoachSessionCookie: (p: string) => string;
let clearCoachSessionCookie: () => string;
let getCoachSessionToken: (req: any) => string;
let isValidCoachToken: (t: string) => boolean;
let COACH_SESSION_TTL_S: number;

beforeAll(async () => {
  const mod = await import("../lib/coachAuth");
  verifyCoachSession      = mod.verifyCoachSession;
  buildCoachSessionCookie = mod.buildCoachSessionCookie;
  clearCoachSessionCookie = mod.clearCoachSessionCookie;
  getCoachSessionToken    = mod.getCoachSessionToken;
  isValidCoachToken       = mod.isValidCoachToken;
  COACH_SESSION_TTL_S     = mod.COACH_SESSION_TTL_S;
});

// ─── verifyCoachSession ───────────────────────────────────────────────────────

describe("verifyCoachSession", () => {
  it("round-trips a valid payload via buildCoachSessionCookie", () => {
    const payload = JSON.stringify({ ts: Date.now(), role: "coach", v: 0 });
    const cookie  = buildCoachSessionCookie(payload);
    const value   = cookie.split(";")[0].split("=").slice(1).join("=");
    expect(verifyCoachSession(value)).toBe(payload);
  });

  it("handles payload with dots in it (lastIndexOf split)", () => {
    const payload = "version.1.2.3";
    const cookie  = buildCoachSessionCookie(payload);
    const value   = cookie.split(";")[0].split("=").slice(1).join("=");
    expect(verifyCoachSession(value)).toBe(payload);
  });

  it("returns null for empty string", () => {
    expect(verifyCoachSession("")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(verifyCoachSession(undefined)).toBeNull();
  });

  it("returns null for string with no dot", () => {
    expect(verifyCoachSession("nodothere")).toBeNull();
  });

  it("returns null for trailing dot only (empty sig)", () => {
    expect(verifyCoachSession("data.")).toBeNull();
  });

  it("returns null for leading dot only (empty data)", () => {
    expect(verifyCoachSession(".sig")).toBeNull();
  });

  it("rejects a cookie with tampered payload", () => {
    const cookie = buildCoachSessionCookie("real-payload");
    const value  = cookie.split(";")[0].split("=").slice(1).join("=");
    const lastDot = value.lastIndexOf(".");
    const sig     = value.slice(lastDot + 1);
    const tampered = Buffer.from("evil-payload").toString("base64url") + "." + sig;
    expect(verifyCoachSession(tampered)).toBeNull();
  });

  it("rejects a cookie with tampered signature", () => {
    const cookie  = buildCoachSessionCookie("real-payload");
    const value   = cookie.split(";")[0].split("=").slice(1).join("=");
    const tampered = value.slice(0, -4) + "XXXX";
    expect(verifyCoachSession(tampered)).toBeNull();
  });
});

// ─── Cross-secret contamination ───────────────────────────────────────────────

describe("cross-secret isolation", () => {
  it("rejects an admin session token signed with SESSION_SECRET", async () => {
    // Sign a token with the admin secret (SESSION_SECRET) — simulates a
    // confused or malicious client presenting an admin cookie to the coach verifier.
    const { signSession } = await import("../lib/security");
    const adminToken = signSession(JSON.stringify({ ts: Date.now(), role: "admin" }));
    expect(verifyCoachSession(adminToken)).toBeNull();
  });
});

// ─── buildCoachSessionCookie ──────────────────────────────────────────────────

describe("buildCoachSessionCookie", () => {
  it("uses the __Host-ak_coach cookie name", () => {
    const cookie = buildCoachSessionCookie("{}");
    expect(cookie).toContain("__Host-ak_coach=");
  });

  it("includes HttpOnly, Secure, SameSite=Strict", () => {
    const cookie = buildCoachSessionCookie("{}");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
  });

  it("includes correct Max-Age", () => {
    const cookie = buildCoachSessionCookie("{}");
    expect(cookie).toContain(`Max-Age=${COACH_SESSION_TTL_S}`);
  });

  it("throws when COACH_SESSION_SECRET is not set", async () => {
    const saved = process.env.COACH_SESSION_SECRET;
    delete process.env.COACH_SESSION_SECRET;
    try {
      expect(() => buildCoachSessionCookie("{}")).toThrow("COACH_SESSION_SECRET is not set");
    } finally {
      process.env.COACH_SESSION_SECRET = saved;
    }
  });
});

// ─── clearCoachSessionCookie ──────────────────────────────────────────────────

describe("clearCoachSessionCookie", () => {
  it("sets Max-Age=0", () => {
    expect(clearCoachSessionCookie()).toContain("Max-Age=0");
  });

  it("uses the correct __Host-ak_coach cookie name", () => {
    expect(clearCoachSessionCookie()).toContain("__Host-ak_coach=");
  });
});

// ─── getCoachSessionToken ─────────────────────────────────────────────────────

describe("getCoachSessionToken", () => {
  it("returns the coach cookie value from req.cookies", () => {
    const req = { cookies: { "__Host-ak_coach": "abc.def" } };
    expect(getCoachSessionToken(req)).toBe("abc.def");
  });

  it("returns empty string when cookie is absent", () => {
    expect(getCoachSessionToken({ cookies: {} })).toBe("");
  });

  it("returns empty string when cookies is undefined", () => {
    expect(getCoachSessionToken({})).toBe("");
  });
});

// ─── isValidCoachToken ────────────────────────────────────────────────────────

describe("isValidCoachToken", () => {
  it("returns true for the correct token", () => {
    expect(isValidCoachToken("correct-coach-token")).toBe(true);
  });

  it("returns false for a wrong token", () => {
    expect(isValidCoachToken("wrong-token")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isValidCoachToken("")).toBe(false);
  });

  it("returns false when COACH_TOKEN env var is not set", () => {
    const saved = process.env.COACH_TOKEN;
    delete process.env.COACH_TOKEN;
    try {
      expect(isValidCoachToken("correct-coach-token")).toBe(false);
    } finally {
      process.env.COACH_TOKEN = saved;
    }
  });
});
