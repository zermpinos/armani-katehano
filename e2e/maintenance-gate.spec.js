import { test, expect } from "@playwright/test";

test.describe("maintenance gate", () => {
  test("public visitor is redirected to /maintenance when mode is on", async ({ page, request }) => {
    await request.post("/api/admin/maintenance", { data: { enabled: true } });

    const res = await page.goto("/");
    expect(new URL(res.url()).pathname).toBe("/maintenance");

    await request.post("/api/admin/maintenance", { data: { enabled: false } });

    const res2 = await page.goto("/");
    expect(res2.status()).toBe(200);
    expect(new URL(res2.url()).pathname).toBe("/");
  });

  test("admin visitor sees live site during maintenance", async ({ page, request }) => {
    await request.post("/api/admin/maintenance", { data: { enabled: true } });

    const res = await page.goto("/");
    expect(res.status()).toBe(200);

    await request.post("/api/admin/maintenance", { data: { enabled: false } });
  });
});
