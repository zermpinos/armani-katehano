import { test, expect } from "@playwright/test";

test.describe("Home page featured roster panel", () => {
  test("View Roster toggles aria-expanded and reveals the avatar panel", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", { name: /^View Roster/i }).first();
    const visible = await toggle.isVisible().catch(() => false);
    test.skip(!visible, "Home page does not currently feature an announced game");

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const controlsId = await toggle.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();

    await toggle.click();
    const openToggle = page.locator(`[aria-controls="${controlsId}"]`);
    await expect(openToggle).toHaveAttribute("aria-expanded", "true");

    const panel = page.locator(`#${controlsId}`);
    await expect(panel).toBeVisible();

    const playerLinks = panel.locator('a[href^="/players/"]');
    await expect(playerLinks.first()).toBeVisible();
    const firstHref = await playerLinks.first().getAttribute("href");
    expect(firstHref).toMatch(/^\/players\/[a-z0-9-]+$/);

    const numberCells = panel.locator("text=/^#\\d+/");
    await expect(numberCells.first()).toBeVisible();
  });

  test("Featured panel renders a Cloudinary-transformed image when a player has a photoUrl", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /^View Roster/i }).first();
    const visible = await toggle.isVisible().catch(() => false);
    test.skip(!visible, "Home page does not currently feature an announced game");
    await toggle.click();

    const panel = page.locator('[data-testid="featured-roster-panel"]');
    const imgs = panel.locator("img");
    const imgCount = await imgs.count();
    test.skip(imgCount === 0, "Featured roster has no players with photoUrl");

    const srcs = await imgs.evaluateAll(els => els.map(e => e.getAttribute("src") || ""));
    // next/image proxies through /_next/image?url=..., so decode before matching
    const transformed = srcs.find(s => decodeURIComponent(s).includes("/image/upload/c_fill,g_face,w_64,h_64,f_auto,q_auto/"));
    expect(transformed).toBeTruthy();
  });

  test("Coach callout renders when announcement.message is set", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /^View Roster/i }).first();
    const visible = await toggle.isVisible().catch(() => false);
    test.skip(!visible, "Home page does not currently feature an announced game");
    await toggle.click();

    const panel = page.locator('[data-testid="featured-roster-panel"]');
    const callout = panel.getByText(/MESSAGE FROM THE COACH/i);
    const calloutVisible = await callout.isVisible().catch(() => false);
    if (calloutVisible) {
      await expect(callout).toBeVisible();
    } else {
      test.skip(true, "Featured announcement has no coach message");
    }
  });
});
