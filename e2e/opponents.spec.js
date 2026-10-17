/**
 * e2e/opponents.spec.js
 * Head-to-head: the opponent page, its 404, and the box score's earlier meetings.
 * Tests that need games self-skip when the database has none.
 */
import { test, expect } from "@playwright/test";

async function firstOpponentPath(request) {
  const res = await request.get("/sitemap.xml");
  if (!res.ok()) return null;
  const match = (await res.text()).match(/<loc>[^<]*(\/opponents\/[a-z0-9-]+)<\/loc>/);
  return match ? match[1] : null;
}

test.describe("Head-to-head", () => {
  test("an opponent page shows the record and links each meeting to its box score", async ({ page, request }) => {
    const path = await firstOpponentPath(request);
    test.skip(path === null, "No opponents in DB - skipping");
    await page.goto(path);
    await expect(page.getByRole("heading", { name: /^vs / })).toBeVisible();
    const every = page.getByRole("region", { name: "Every meeting" });
    await expect(every.getByText(/^Record: \d+-\d+/)).toBeVisible();
    await expect(every.getByRole("link").first()).toHaveAttribute("href", /^\/games\/c[0-9a-z]{24}$/);
  });

  test("an unknown opponent is a 404", async ({ request }) => {
    const res = await request.get("/opponents/no-such-team-zz");
    expect(res.status()).toBe(404);
  });
});
