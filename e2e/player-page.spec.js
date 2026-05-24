import { test, expect } from "@playwright/test";

test.describe("Player standalone page (/players/[slug])", () => {
  test("clicking a player card navigates to /players/[slug]", async ({ page }) => {
    await page.goto("/players");
    const firstCard = page.locator("a[href^='/players/']").first();
    const cardCount = await firstCard.count();
    test.skip(cardCount === 0, "No players in DB");
    const href = await firstCard.getAttribute("href");
    if (!href) return;
    await firstCard.click();
    await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  test("player page loads without JS errors when navigated to directly", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/players");
    const firstCard = page.locator("a[href^='/players/']").first();
    const cardCount = await firstCard.count();
    test.skip(cardCount === 0, "No players in DB");
    const href = await firstCard.getAttribute("href");
    if (!href) return;
    await page.goto(href);
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });

  test("player page title contains '— Players'", async ({ page }) => {
    await page.goto("/players");
    const firstCard = page.locator("a[href^='/players/']").first();
    const cardCount = await firstCard.count();
    test.skip(cardCount === 0, "No players in DB");
    const href = await firstCard.getAttribute("href");
    if (!href) return;
    await page.goto(href);
    await expect(page).toHaveTitle(/— Players/i);
  });

  test("/players/unknown-slug returns 404", async ({ page }) => {
    const response = await page.goto("/players/this-slug-does-not-exist-xyz-404test");
    expect(response.status()).toBe(404);
  });
});
