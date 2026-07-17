import { test, expect } from "@playwright/test";
import { makeAdminAuth } from "./helpers/admin-auth.js";

const SESSION_SECRET = process.env.SESSION_SECRET;
const BASE_URL       = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// This test creates a real game through the live admin API, so the write lands
// in whatever database backs BASE_URL, not in the runner's DATABASE_URL. Only
// the caller knows whether that database is disposable, so it must say so.
const WRITABLE_TARGET = process.env.E2E_WRITABLE_TARGET === "1";

async function pollFor(page, url, condition, { timeout = 30_000, interval = 1_000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    const body = await response.text();
    if (condition(body)) return body;
    await page.waitForTimeout(interval);
  }
  throw new Error(`Condition not met within ${timeout}ms for ${url}`);
}

test.describe("ISR freshness after admin write", () => {
  test.skip(!SESSION_SECRET, "SESSION_SECRET not configured; skipping ISR freshness test");
  test.skip(!WRITABLE_TARGET, "E2E_WRITABLE_TARGET is not set; this test writes a real game to the database behind BASE_URL and only runs against a disposable one");

  test("new game appears on /games within 30 s of POST", async ({ page }) => {
    const { cookies, authHeaders } = makeAdminAuth();
    await page.context().addCookies(cookies);
    // Navigate first so page.request sends SameSite=Strict cookies (about:blank context blocks them).
    await page.goto(BASE_URL + "/");

    // Fetch the first available season-league from the preview DB.
    const slRes = await page.request.get(`${BASE_URL}/api/admin/season-leagues`, { headers: authHeaders });
    if (slRes.status() === 401 || slRes.status() === 403) {
      // SESSION_SECRET mismatch between CI and Vercel preview is an env config
      // issue, not a code bug under test; skip rather than fail.
      test.skip(true, `Auth rejected by preview (status ${slRes.status()}). Ensure SESSION_SECRET matches in Vercel preview env.`);
      return;
    }
    expect(slRes.ok()).toBeTruthy();
    const { seasonLeagues } = await slRes.json();
    if (!seasonLeagues?.length) {
      test.skip(true, "No season-leagues in preview DB; skipping freshness test");
      return;
    }
    const seasonLeagueId = seasonLeagues[0].id;

    const create = await page.request.post(`${BASE_URL}/api/admin/games`, {
      headers: authHeaders,
      data: {
        seasonLeagueId,
        opponent:      `E2E ISR Test ${Date.now()}`,
        location:      "home",
        teamScore:     80,
        opponentScore: 70,
        result:        "W",
        playedOn:      new Date().toISOString().split("T")[0],
      },
    });
    expect(create.ok()).toBeTruthy();
    const { gameId } = await create.json();

    const removeGame = () => page.request.delete(`${BASE_URL}/api/admin/games`, {
      headers: authHeaders,
      data: { gameId },
    });

    let removed = false;
    try {
      await pollFor(page, "/games",           body => body.includes(gameId));
      await pollFor(page, `/games/${gameId}`, body => body.includes(gameId));
      await pollFor(page, "/sitemap.xml",     body => body.includes(gameId));

      const del = await removeGame();
      expect(del.ok()).toBeTruthy();
      removed = true;

      await pollFor(page, "/games", body => !body.includes(gameId));
    } finally {
      // A throw above (a poll timing out) would otherwise strand the game in the
      // database, where it shows up as a real fixture on the site.
      if (!removed) await removeGame().catch(() => {});
    }
  });
});
