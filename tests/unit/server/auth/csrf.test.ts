// @ts-nocheck
import { describe, it, expect } from "vitest";
import { buildCsrfCookie, clearCsrfCookie, csrfTokenCheck, generateCsrfToken } from "@/server/auth/csrf";
import { SESSION_TTL_S } from "@/server/auth/session";

const COOKIE = "__Host-ak_csrf";

function req({ method = "POST", cookie, header }) {
  return {
    method,
    cookies: cookie === undefined ? {} : { [COOKIE]: cookie },
    headers: header === undefined ? {} : { "x-csrf-token": header },
  };
}

describe("buildCsrfCookie", () => {
  // Issued only at login and never re-issued. With no Max-Age the browser drops
  // it on close while keeping the session cookie, which has one. The admin comes
  // back still logged in but unable to send any mutating request, with no way
  // out but logging in again.
  it("lives as long as the session cookie it is paired with", () => {
    expect(buildCsrfCookie("tok")).toContain(`Max-Age=${SESSION_TTL_S}`);
  });

  it("still satisfies what the __Host- prefix requires", () => {
    const cookie = buildCsrfCookie("tok");
    expect(cookie.startsWith(`${COOKIE}=tok`)).toBe(true);
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Strict");
    // A Domain attribute would void the prefix entirely.
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it("clears with an expiry the browser will act on", () => {
    expect(clearCsrfCookie()).toContain("Max-Age=0");
  });
});

describe("csrfTokenCheck", () => {
  it("passes when the cookie and header agree", () => {
    const t = generateCsrfToken();
    expect(csrfTokenCheck(req({ cookie: t, header: t }))).toBe(true);
  });

  // The exact shape of the reported failure: cookie gone, so apiFetch sends no
  // header at all.
  it("fails when the cookie is missing", () => {
    expect(csrfTokenCheck(req({ header: "anything" }))).toBe(false);
  });

  it("fails when the header is missing", () => {
    expect(csrfTokenCheck(req({ cookie: "tok" }))).toBe(false);
  });

  it("fails when they do not match", () => {
    expect(csrfTokenCheck(req({ cookie: "aaaa", header: "bbbb" }))).toBe(false);
  });

  it("fails on a length mismatch without throwing", () => {
    expect(csrfTokenCheck(req({ cookie: "short", header: "muchlongervalue" }))).toBe(false);
  });

  it("does not apply to non-mutating methods", () => {
    expect(csrfTokenCheck(req({ method: "GET" }))).toBe(true);
  });
});
