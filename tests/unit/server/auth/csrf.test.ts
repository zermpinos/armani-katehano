// @ts-nocheck
import { describe, it, expect, beforeAll } from "vitest";
import { buildCsrfCookie, clearCsrfCookie, csrfTokenCheck, generateCsrfToken } from "@/server/auth/csrf";
import { SESSION_TTL_S } from "@/server/auth/session";

const COOKIE  = "__Host-ak_csrf";
const SESSION = "cGF5bG9hZA.signature-for-session-a";
const OTHER   = "cGF5bG9hZA.signature-for-session-b";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-for-csrf-tests";
});

function req({ method = "POST", cookie, header }) {
  return {
    method,
    cookies: cookie === undefined ? {} : { [COOKIE]: cookie },
    headers: header === undefined ? {} : { "x-csrf-token": header },
  };
}

function flipLast(s: string) {
  return s.slice(0, -1) + (s.endsWith("a") ? "b" : "a");
}

describe("buildCsrfCookie", () => {
  // Issued only at login and never re-issued. With no Max-Age the browser drops
  // it on close while keeping the session cookie, which has one. The admin comes
  // back still logged in but unable to send any mutating request, with no way
  // out but logging in again.
  it("lives as long as the session cookie it is paired with", () => {
    expect(buildCsrfCookie(SESSION)).toContain(`Max-Age=${SESSION_TTL_S}`);
  });

  it("still satisfies what the __Host- prefix requires", () => {
    const cookie = buildCsrfCookie(SESSION);
    expect(cookie.startsWith(`${COOKIE}=`)).toBe(true);
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Strict");
    // A Domain attribute would void the prefix entirely.
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it("mints a value bound to the session it was given", () => {
    const value = buildCsrfCookie(SESSION).split(";")[0].slice(COOKIE.length + 1);
    expect(csrfTokenCheck(req({ cookie: value, header: value }), SESSION)).toBe(true);
  });

  it("clears with an expiry the browser will act on", () => {
    expect(clearCsrfCookie()).toContain("Max-Age=0");
  });
});

describe("csrfTokenCheck", () => {
  it("passes when the cookie and header agree and the token binds to the session", () => {
    const t = generateCsrfToken(SESSION);
    expect(csrfTokenCheck(req({ cookie: t, header: t }), SESSION)).toBe(true);
  });

  it("rejects a token minted for another session", () => {
    const t = generateCsrfToken(OTHER);
    expect(csrfTokenCheck(req({ cookie: t, header: t }), SESSION)).toBe(false);
  });

  it("rejects a tampered binding", () => {
    const [nonce, binding] = generateCsrfToken(SESSION).split(".");
    const forged = `${nonce}.${flipLast(binding)}`;
    expect(csrfTokenCheck(req({ cookie: forged, header: forged }), SESSION)).toBe(false);
  });

  it("rejects a tampered nonce", () => {
    const [nonce, binding] = generateCsrfToken(SESSION).split(".");
    const forged = `${flipLast(nonce)}.${binding}`;
    expect(csrfTokenCheck(req({ cookie: forged, header: forged }), SESSION)).toBe(false);
  });

  // What an attacker who can write the cookie can produce on their own.
  it("rejects a value that carries no binding at all", () => {
    expect(csrfTokenCheck(req({ cookie: "tok", header: "tok" }), SESSION)).toBe(false);
  });

  it("rejects when there is no session to bind against", () => {
    const t = generateCsrfToken(SESSION);
    expect(csrfTokenCheck(req({ cookie: t, header: t }), "")).toBe(false);
  });

  // The exact shape of the reported failure: cookie gone, so apiFetch sends no
  // header at all.
  it("fails when the cookie is missing", () => {
    expect(csrfTokenCheck(req({ header: "anything" }), SESSION)).toBe(false);
  });

  it("fails when the header is missing", () => {
    expect(csrfTokenCheck(req({ cookie: generateCsrfToken(SESSION) }), SESSION)).toBe(false);
  });

  it("fails when they do not match", () => {
    expect(csrfTokenCheck(
      req({ cookie: generateCsrfToken(SESSION), header: generateCsrfToken(SESSION) }),
      SESSION,
    )).toBe(false);
  });

  it("fails on a length mismatch without throwing", () => {
    expect(csrfTokenCheck(req({ cookie: "short", header: "muchlongervalue" }), SESSION)).toBe(false);
  });

  it("does not apply to non-mutating methods", () => {
    expect(csrfTokenCheck(req({ method: "GET" }), SESSION)).toBe(true);
  });
});
