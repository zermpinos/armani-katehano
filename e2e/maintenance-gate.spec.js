import { test, expect } from "@playwright/test";
import { makeAdminAuth } from "./helpers/admin-auth.js";
import { isWritableTarget } from "./helpers/db-guard.js";

const SESSION_SECRET = process.env.SESSION_SECRET;
const BASE_URL       = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function sessionCookie(value) {
  return {
    name:     "__Host-ak_session",
    value,
    domain:   new URL(BASE_URL).hostname,
    path:     "/",
    secure:   true,
    httpOnly: true,
    sameSite: "Strict",
    expires:  -1,
  };
}

function forgedAdminValue() {
  const data = Buffer.from(JSON.stringify({ ts: Date.now(), role: "admin", user: "attacker" })).toString("base64url");
  return `${data}.${"A".repeat(43)}`;
}

// Poll a cookieless visitor until the gate reaches `redirected`. Waiting for it
// to go live stops a later assertion mistaking a not-yet-live gate for a
// successful bypass. Waiting for it to clear matters just as much: proxy.ts
// caches the flag for 10s, so a test that returns as soon as the POST lands
// leaves that cache redirecting whatever specs run next.
async function waitForGate(browser, redirected) {
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  try {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const res = await page.goto(BASE_URL + "/");
      if ((new URL(res.url()).pathname === "/maintenance") === redirected) return true;
      await page.waitForTimeout(1_000);
    }
    return false;
  } finally {
    await ctx.close();
  }
}

async function setMaintenance(page, authHeaders, enabled) {
  return page.request.post(`${BASE_URL}/api/admin/maintenance`, {
    headers: authHeaders,
    data: { enabled },
  });
}

async function clearMaintenance(page, authHeaders, browser) {
  await setMaintenance(page, authHeaders, false);
  await waitForGate(browser, false);
}

// The maintenance flag is global server state and every test here toggles it,
// so they must not overlap.
test.describe.configure({ mode: "serial" });

test.describe("maintenance gate", () => {
  test.skip(!SESSION_SECRET, "SESSION_SECRET not configured; skipping maintenance gate tests");
  // The flag is a row in the database behind BASE_URL, and every test here turns
  // it on. Against a database that also serves the live site, a run that dies
  // before its cleanup leaves the public site redirecting to /maintenance.
  test.skip(!isWritableTarget(), "E2E_WRITABLE_TARGET is not set; these tests toggle the global maintenance flag and only run against a disposable database");

  test("public visitor is redirected to /maintenance when mode is on", async ({ browser }) => {
    const { cookies, authHeaders } = makeAdminAuth();

    // Navigate first so page.request sends SameSite=Strict cookies (about:blank context blocks them).
    const adminCtx  = await browser.newContext();
    await adminCtx.addCookies(cookies);
    const adminPage = await adminCtx.newPage();
    await adminPage.goto(BASE_URL + "/");

    const enableRes = await setMaintenance(adminPage, authHeaders, true);
    if (enableRes.status() === 401 || enableRes.status() === 403) {
      // SESSION_SECRET mismatch between CI and Vercel preview leaves the flag
      // unchanged; skip rather than surface as a missing redirect.
      test.skip(true, `Auth rejected by preview (status ${enableRes.status()}). Ensure SESSION_SECRET matches in Vercel preview env.`);
      return;
    }
    expect(enableRes.ok()).toBeTruthy();

    try {
      expect(await waitForGate(browser, true)).toBe(true);
    } finally {
      await clearMaintenance(adminPage, authHeaders, browser);
      await adminCtx.close();
    }
  });

  test("admin visitor sees live site during maintenance", async ({ browser }) => {
    const { cookies, authHeaders } = makeAdminAuth();

    // Navigate first so page.request sends SameSite=Strict cookies (about:blank context blocks them).
    const adminCtx  = await browser.newContext();
    await adminCtx.addCookies(cookies);
    const setupPage = await adminCtx.newPage();
    await setupPage.goto(BASE_URL + "/");

    const enableRes = await setMaintenance(setupPage, authHeaders, true);
    if (enableRes.status() === 401 || enableRes.status() === 403) {
      test.skip(true, `Auth rejected by preview (status ${enableRes.status()}). Ensure SESSION_SECRET matches in Vercel preview env.`);
      return;
    }
    expect(enableRes.ok()).toBeTruthy();

    try {
      // Landing on / only means anything once the gate is turning others away.
      // Without this the assertion below passes whenever maintenance is off.
      expect(await waitForGate(browser, true), "gate never went live; the bypass proves nothing").toBe(true);

      // Admin page carries a signed __Host-ak_session, so the gate verifies it
      // and lets the request through.
      const page = await adminCtx.newPage();
      const res  = await page.goto("/");
      expect(res.status()).toBe(200);
      expect(new URL(res.url()).pathname).toBe("/");
    } finally {
      await clearMaintenance(setupPage, authHeaders, browser);
      await adminCtx.close();
    }
  });

  test("forged or empty session cookie does not bypass the gate", async ({ browser }) => {
    const { cookies, authHeaders } = makeAdminAuth();

    const adminCtx = await browser.newContext();
    await adminCtx.addCookies(cookies);
    const adminPage = await adminCtx.newPage();
    await adminPage.goto(BASE_URL + "/");

    const enableRes = await setMaintenance(adminPage, authHeaders, true);
    if (enableRes.status() === 401 || enableRes.status() === 403) {
      test.skip(true, `Auth rejected by preview (status ${enableRes.status()}). Ensure SESSION_SECRET matches in Vercel preview env.`);
      return;
    }
    expect(enableRes.ok()).toBeTruthy();

    try {
      expect(await waitForGate(browser, true), "gate never went live; cannot judge a bypass").toBe(true);

      const forgeries = [
        ["arbitrary value",       "not-a-real-session"],
        ["forged admin payload",  forgedAdminValue()],
        ["empty value",           ""],
      ];

      for (const [label, value] of forgeries) {
        const ctx = await browser.newContext();
        await ctx.addCookies([sessionCookie(value)]);
        const page = await ctx.newPage();
        try {
          const res = await page.goto(BASE_URL + "/");
          expect(new URL(res.url()).pathname, `${label} bypassed the maintenance gate`).toBe("/maintenance");
        } finally {
          await ctx.close();
        }
      }
    } finally {
      await clearMaintenance(adminPage, authHeaders, browser);
      await adminCtx.close();
    }
  });
});
