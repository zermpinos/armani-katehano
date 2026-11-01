import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret-for-admin-page-props");
  vi.stubEnv("ADMIN_SLUG", "right-slug");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load() {
  const session = await import("@/server/auth/session");
  const { getAdminPageProps } = await import("@/server/auth/admin-slug");
  return { ...session, getAdminPageProps };
}

function ctx(slug: string, cookie?: string) {
  return { params: { slug }, query: {}, req: { cookies: cookie ? { "__Host-ak_session": cookie } : {} } } as any;
}

const cookieFor = (signSession: (p: string) => string, payload: object) => signSession(JSON.stringify(payload));

describe("getAdminPageProps", () => {
  it("404s a wrong slug", async () => {
    const { getAdminPageProps } = await load();
    expect(await getAdminPageProps(ctx("wrong-slug"))).toEqual({ notFound: true });
  });

  it("a live admin session is authed", async () => {
    const { getAdminPageProps, signSession } = await load();
    const cookie = cookieFor(signSession, { ts: Date.now(), role: "admin", user: "admin" });
    expect(await getAdminPageProps(ctx("right-slug", cookie))).toEqual({ props: { authed: true } });
  });

  it("no cookie is signed out", async () => {
    const { getAdminPageProps } = await load();
    expect(await getAdminPageProps(ctx("right-slug"))).toEqual({ props: { authed: false } });
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
});
