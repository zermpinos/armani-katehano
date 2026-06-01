/**
 * e2e/games-modal.spec.js
 * E2E tests for game card navigation and the standalone game detail page.
 *
 * Played game cards navigate to /games/[id] instead of opening a modal.
 * Tests that depend on a game card existing in the DB will self-skip when
 * the DB has no games (fresh environment / CI without seed data).
 */
import { test, expect } from "@playwright/test";

async function findFirstGameCard(page) {
  const cards = page.getByText("BOX SCORE ->");
  const count = await cards.count();
  if (count === 0) return null;
  return cards.first();
}

test.describe("Games page - navigation", () => {
  test("game card is visible when DB has games", async ({ page }) => {
    await page.goto("/games");
    await page.waitForLoadState("networkidle");
    const card = await findFirstGameCard(page);
    test.skip(card === null, "No games in DB - skipping");
    await expect(card).toBeVisible();
  });

  test("clicking a game card navigates to /games/[id]", async ({ page }) => {
    await page.goto("/games");
    await page.waitForLoadState("networkidle");
    const card = await findFirstGameCard(page);
    test.skip(card === null, "No games in DB - skipping");
    await card.click();
    await page.waitForURL(/\/games\/[a-z0-9]+/i, { timeout: 8000 });
    expect(page.url()).toMatch(/\/games\/[a-z0-9]+/i);
  });

  test("game detail page renders stat column headers", async ({ page }) => {
    await page.goto("/games");
    await page.waitForLoadState("networkidle");
    const card = await findFirstGameCard(page);
    test.skip(card === null, "No games in DB - skipping");
    await card.click();
    await page.waitForURL(/\/games\/[a-z0-9]+/i, { timeout: 8000 });
    await expect(page.getByText("PTS").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("EFF").first()).toBeVisible({ timeout: 8000 });
  });

  test("game detail page has back link to /games", async ({ page }) => {
    await page.goto("/games");
    await page.waitForLoadState("networkidle");
    const card = await findFirstGameCard(page);
    test.skip(card === null, "No games in DB - skipping");
    await card.click();
    await page.waitForURL(/\/games\/[a-z0-9]+/i, { timeout: 8000 });
    await expect(page.getByText("← Games")).toBeVisible({ timeout: 8000 });
  });

  test("no modal × button present on the games list page", async ({ page }) => {
    await page.goto("/games");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "×" })).not.toBeVisible();
  });

  test("box score player name links to /players/[slug]", async ({ page }) => {
    await page.goto("/games");
    await page.waitForLoadState("networkidle");
    const card = await findFirstGameCard(page);
    test.skip(card === null, "No games in DB - skipping");
    await card.click();
    await page.waitForURL(/\/games\/[a-z0-9]+/i, { timeout: 8000 });

    const playerLink = page.locator("a[href^='/players/']").first();
    test.skip(await playerLink.count() === 0, "No players in box score - skipping");
    const playerHref = await playerLink.getAttribute("href");
    await playerLink.click();
    // eslint-disable-next-line security/detect-non-literal-regexp
    await page.waitForURL(new RegExp(playerHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), { timeout: 8000 });
    expect(page.url()).toContain("/players/");
  });
});
