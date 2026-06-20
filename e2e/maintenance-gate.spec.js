import { test, expect } from "@playwright/test";
import { makeAdminAuth } from "./helpers/admin-auth.js";

const SESSION_SECRET = process.env.SESSION_SECRET;
const BASE_URL       = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("maintenance gate", () => {
  test.skip(!SESSION_SECRET, "SESSION_SECRET not configured — skipping maintenance gate tests");

  test("public visitor is redirected to /maintenance when mode is on", async ({ browser }) => {
    const { cookies, authHeaders } = makeAdminAuth();

    // Enable maintenance via authenticated admin API call.
    const adminCtx = await browser.newContext();
    await adminCtx.addCookies(cookies);
    await adminCtx.request.post(`${BASE_URL}/api/admin/maintenance`, {
      headers: authHeaders,
      data: { enabled: true },
    });
    await adminCtx.close();

    // Public visitor (no session cookie) should be redirected.
    const publicCtx = await browser.newContext();
    const page      = await publicCtx.newPage();
    try {
      const res = await page.goto("/");
      expect(new URL(res.url()).pathname).toBe("/maintenance");
    } finally {
      // Always restore regardless of assertion outcome.
      const restoreCtx = await browser.newContext();
      await restoreCtx.addCookies(cookies);
      await restoreCtx.request.post(`${BASE_URL}/api/admin/maintenance`, {
        headers: authHeaders,
        data: { enabled: false },
      });
      await restoreCtx.close();
      await publicCtx.close();
    }
  });

  test("admin visitor sees live site during maintenance", async ({ browser }) => {
    const { cookies, authHeaders } = makeAdminAuth();

    const adminCtx = await browser.newContext();
    await adminCtx.addCookies(cookies);
    await adminCtx.request.post(`${BASE_URL}/api/admin/maintenance`, {
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
      await adminCtx.request.post(`${BASE_URL}/api/admin/maintenance`, {
        headers: authHeaders,
        data: { enabled: false },
      });
      await adminCtx.close();
    }
  });
});
