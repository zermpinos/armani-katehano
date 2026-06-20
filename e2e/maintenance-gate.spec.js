import { test, expect } from "@playwright/test";
import { makeAdminAuth } from "./helpers/admin-auth.js";

const SESSION_SECRET = process.env.SESSION_SECRET;
const BASE_URL       = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("maintenance gate", () => {
  test.skip(!SESSION_SECRET, "SESSION_SECRET not configured — skipping maintenance gate tests");

  test("public visitor is redirected to /maintenance when mode is on", async ({ browser }) => {
    const { cookies, authHeaders } = makeAdminAuth();

    // Navigate first so page.request sends SameSite=Strict cookies (about:blank context blocks them).
    const adminCtx  = await browser.newContext();
    await adminCtx.addCookies(cookies);
    const adminPage = await adminCtx.newPage();
    await adminPage.goto(BASE_URL + "/");

    await adminPage.request.post(`${BASE_URL}/api/admin/maintenance`, {
      headers: authHeaders,
      data: { enabled: true },
    });

    const publicCtx = await browser.newContext();
    const page      = await publicCtx.newPage();
    try {
      // Poll up to 15s: middleware caches the flag for 10s, so the redirect
      // may not fire immediately even after the POST succeeds.
      let pathname = "/";
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        const res = await page.goto(BASE_URL + "/");
        pathname = new URL(res.url()).pathname;
        if (pathname === "/maintenance") break;
        await page.waitForTimeout(1_000);
      }
      expect(pathname).toBe("/maintenance");
    } finally {
      await adminPage.request.post(`${BASE_URL}/api/admin/maintenance`, {
        headers: authHeaders,
        data: { enabled: false },
      });
      await adminCtx.close();
      await publicCtx.close();
    }
  });

  test("admin visitor sees live site during maintenance", async ({ browser }) => {
    const { cookies, authHeaders } = makeAdminAuth();

    // Navigate first so page.request sends SameSite=Strict cookies (about:blank context blocks them).
    const adminCtx  = await browser.newContext();
    await adminCtx.addCookies(cookies);
    const setupPage = await adminCtx.newPage();
    await setupPage.goto(BASE_URL + "/");

    await setupPage.request.post(`${BASE_URL}/api/admin/maintenance`, {
      headers: authHeaders,
      data: { enabled: true },
    });

    try {
      // Admin page (has __Host-ak_session) — middleware sees cookie, bypasses maintenance.
      const page = await adminCtx.newPage();
      const res  = await page.goto("/");
      expect(res.status()).toBe(200);
      expect(new URL(res.url()).pathname).toBe("/");
    } finally {
      await setupPage.request.post(`${BASE_URL}/api/admin/maintenance`, {
        headers: authHeaders,
        data: { enabled: false },
      });
      await adminCtx.close();
    }
  });
});
