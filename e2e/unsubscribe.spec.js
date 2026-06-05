/**
 * e2e/unsubscribe.spec.js
 * Playwright tests for the /unsubscribe page.
 *
 * Primary regression target: M-5 - the token must be stripped from the URL via
 * history.replaceState() before the DELETE /api/subscribe fetch fires, so it
 * never lands in browser history or Referer headers.
 */
import { test, expect } from "@playwright/test";

test.describe("Unsubscribe page (/unsubscribe)", () => {
  test("strips the token from the URL immediately after reading it (M-5 regression)", async ({ page }) => {
    await page.goto("/unsubscribe?token=supersecrettoken123");
    // Wait for React to hydrate and call history.replaceState - the terminal state
    // appearing means the component has run its effect (and stripped the token).
    await expect(page.getByText(/unsubscribed|invalid|expired/i)).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("token=");
    expect(page.url()).toMatch(/\/unsubscribe$/);
  });

  test("URL is clean when navigated to without a token", async ({ page }) => {
    await page.goto("/unsubscribe");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("token=");
  });

  test("shows error state when accessed without a token", async ({ page }) => {
    await page.goto("/unsubscribe");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).toMatch(/invalid|expired/i);
  });

  test("shows a terminal state (done or error) after processing an invalid token", async ({ page }) => {
    await page.goto("/unsubscribe?token=definitelynotavalidtoken");
    // Never stuck on "pending" - must resolve to done or error
    await expect(page.getByText(/unsubscribed|invalid|expired/i)).toBeVisible({ timeout: 10_000 });
  });

  test("no JS errors on load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/unsubscribe?token=testtoken");
    await expect(page.getByText(/unsubscribed|invalid|expired/i)).toBeVisible({ timeout: 10_000 });
    expect(errors).toHaveLength(0);
  });
});
