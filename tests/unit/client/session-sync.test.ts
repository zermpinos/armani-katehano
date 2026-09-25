import { describe, it, expect } from "vitest";
import { afterPageLoad, afterRelogin, type SessionView } from "@/client/admin/session-sync";

const signedIn:  SessionView = { authed: true,  expired: false, reloadAfterLogin: false };
const signedOut: SessionView = { authed: false, expired: false, reloadAfterLogin: false };

describe("afterPageLoad", () => {
  it("a signed-in server answer clears an expired view", () => {
    const view = { authed: true, expired: true, reloadAfterLogin: true };
    expect(afterPageLoad(view, true)).toEqual({ authed: true, expired: false, reloadAfterLogin: false });
  });

  it("a signed-in server answer signs in a signed-out view", () => {
    expect(afterPageLoad(signedOut, true)).toEqual(signedIn);
  });

  it("a signed-out server answer expires a signed-in view and asks for a reload", () => {
    expect(afterPageLoad(signedIn, false)).toEqual({ authed: true, expired: true, reloadAfterLogin: true });
  });

  it("a signed-out server answer leaves a signed-out view alone", () => {
    expect(afterPageLoad(signedOut, false)).toEqual(signedOut);
  });
});

describe("afterRelogin", () => {
  it("remounts the page when the expiry came from a page load", () => {
    const { view, remount } = afterRelogin({ authed: true, expired: true, reloadAfterLogin: true });
    expect(remount).toBe(true);
    expect(view).toEqual(signedIn);
  });

  it("keeps the page when the expiry came from a 401", () => {
    const { view, remount } = afterRelogin({ authed: true, expired: true, reloadAfterLogin: false });
    expect(remount).toBe(false);
    expect(view).toEqual(signedIn);
  });
});
