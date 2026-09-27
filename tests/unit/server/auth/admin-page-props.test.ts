import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { count } = vi.hoisted(() => ({ count: vi.fn() }));
vi.mock("@/server/db/client", () => ({ default: { passkeyCredential: { count } } }));

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret-for-admin-page-props");
  vi.stubEnv("ADMIN_SLUG", "right-slug");
  vi.stubEnv("PASSKEY_FALLBACK_TOKEN", "fallback-token");
  count.mockReset();
  count.mockResolvedValue(0);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load() {
  const session = await import("@/server/auth/session");
  const { getAdminPageProps } = await import("@/server/auth/passkey");
  return { ...session, getAdminPageProps };
}

function ctx(slug: string, cookie?: string, query: Record<string, string> = {}) {
  return { params: { slug }, query, req: { cookies: cookie ? { "__Host-ak_session": cookie } : {} } } as any;
}

const cookieFor = (signSession: (p: string) => string, payload: object) => signSession(JSON.stringify(payload));

describe("getAdminPageProps", () => {
  it("404s a wrong slug without touching the database", async () => {
    const { getAdminPageProps } = await load();
    expect(await getAdminPageProps(ctx("wrong-slug"))).toEqual({ notFound: true });
    expect(count).not.toHaveBeenCalled();
  });

  it("a live admin session is authed and skips the passkey count", async () => {
    const { getAdminPageProps, signSession } = await load();
    const cookie = cookieFor(signSession, { ts: Date.now(), role: "admin", user: "admin" });
    const result = await getAdminPageProps(ctx("right-slug", cookie)) as any;
    expect(result.props.authed).toBe(true);
    expect(result.props.noPasskeys).toBe(false);
    expect(count).not.toHaveBeenCalled();
  });

  it("no cookie is signed out and reports an empty passkey table", async () => {
    const { getAdminPageProps } = await load();
    const result = await getAdminPageProps(ctx("right-slug")) as any;
    expect(result.props.authed).toBe(false);
    expect(result.props.noPasskeys).toBe(true);
    expect(count).toHaveBeenCalledOnce();
  });

  it("an expired session is signed out", async () => {
    const { getAdminPageProps, signSession, SESSION_TTL_S } = await load();
    const cookie = cookieFor(signSession, { ts: Date.now() - (SESSION_TTL_S + 1) * 1000, role: "admin", user: "admin" });
    expect((await getAdminPageProps(ctx("right-slug", cookie)) as any).props.authed).toBe(false);
  });

  it("a non-admin role is signed out", async () => {
    const { getAdminPageProps, signSession } = await load();
    const cookie = cookieFor(signSession, { ts: Date.now(), role: "coach", user: "coach" });
    expect((await getAdminPageProps(ctx("right-slug", cookie)) as any).props.authed).toBe(false);
  });

  it("a tampered cookie is signed out", async () => {
    const { getAdminPageProps, signSession } = await load();
    const cookie = cookieFor(signSession, { ts: Date.now(), role: "admin", user: "admin" }) + "x";
    expect((await getAdminPageProps(ctx("right-slug", cookie)) as any).props.authed).toBe(false);
  });

  it("shows the fallback form only for the exact token", async () => {
    const { getAdminPageProps } = await load();
    expect((await getAdminPageProps(ctx("right-slug", undefined, { fallback: "fallback-token" })) as any).props.showFallback).toBe(true);
    expect((await getAdminPageProps(ctx("right-slug", undefined, { fallback: "fallback-tokeN" })) as any).props.showFallback).toBe(false);
  });
});
