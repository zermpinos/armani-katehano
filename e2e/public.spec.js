/**
 * e2e/public.spec.js
 * E2E tests for public-facing pages.
 *
 * These tests verify that pages render without crashing and key structural
 * elements are present -- they are intentionally resilient to empty DB state
 * (no games / no players yet).
 */
import { test, expect } from "@playwright/test";

// ─── Homepage ─────────────────────────────────────────────────────────────────

test.describe("Homepage (/)", () => {
  test("loads without a 500 error", async ({ page }) => {
    const response = await page.goto("/");
    expect(response.status()).not.toBe(500);
    expect(response.status()).not.toBe(404);
  });

  test("renders the page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Armani Katehano/i);
  });

  test("renders navigation links", async ({ page }) => {
    await page.goto("/");
    // Layout nav should have links to main sections
    await expect(page.getByRole("link", { name: /games/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /leaderboard/i })).toBeVisible();
  });

  test("renders the hero / record section without crashing", async ({ page }) => {
    await page.goto("/");
    // Page should contain at least one heading or stat element
    const body = await page.textContent("body");
    expect(body.length).toBeGreaterThan(50);
    // No JS error dialog
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });
});

// ─── Games page ───────────────────────────────────────────────────────────────

test.describe("Games page (/games)", () => {
  test("loads without a 500 error", async ({ page }) => {
    const response = await page.goto("/games");
    expect(response.status()).not.toBe(500);
  });

  test("renders the page title", async ({ page }) => {
    await page.goto("/games");
    await expect(page).toHaveTitle(/games/i);
  });

  test("renders a season selector", async ({ page }) => {
    await page.goto("/games");
    // SeasonSelector component renders a select or button group
    const body = await page.textContent("body");
    expect(body).toMatch(/\d{4}/); // at least one year visible
  });

  test("no JS errors on load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/games");
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });
});

// ─── Leaderboard page ─────────────────────────────────────────────────────────

test.describe("Leaderboard page (/leaderboard)", () => {
  test("loads without a 500 error", async ({ page }) => {
    const response = await page.goto("/leaderboard");
    expect(response.status()).not.toBe(500);
  });

  test("renders the page title", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page).toHaveTitle(/leaderboard/i);
  });

  test("no JS errors on load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/leaderboard");
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });
});

// ─── Players page ─────────────────────────────────────────────────────────────

test.describe("Players page (/players)", () => {
  test("loads without a 500 error", async ({ page }) => {
    const response = await page.goto("/players");
    expect(response.status()).not.toBe(500);
  });

  test("no JS errors on load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/players");
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });
});

// ─── 404 page ─────────────────────────────────────────────────────────────────

test.describe("404 page", () => {
  test("returns 404 for unknown routes", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response.status()).toBe(404);
  });

  test("renders inside the layout (not a blank page)", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    // Layout nav should still be present
    const body = await page.textContent("body");
    expect(body.length).toBeGreaterThan(20);
  });
});

// ─── Navigation between pages ─────────────────────────────────────────────────

test.describe("Navigation", () => {
  test("clicking Games nav link navigates to /games", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /games/i }).click();
    await expect(page).toHaveURL(/\/games/);
  });

  test("clicking Leaderboard nav link navigates to /leaderboard", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /leaderboard/i }).click();
    await expect(page).toHaveURL(/\/leaderboard/);
  });
});
