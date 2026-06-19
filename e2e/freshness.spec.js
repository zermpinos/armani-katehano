import { test, expect } from "@playwright/test";

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
  test("new game appears on /games within 30 s of POST", async ({ page, request }) => {
    const create = await request.post("/api/admin/games", {
      data: {
        seasonLeagueId: process.env.TEST_SEASON_LEAGUE_ID,
        opponent: `E2E Test Opponent ${Date.now()}`,
        location: "home",
        teamScore: 80,
        opponentScore: 70,
        result: "W",
        playedOn: new Date().toISOString().split("T")[0],
      },
    });
    expect(create.ok()).toBeTruthy();
    const { gameId } = await create.json();

    await pollFor(page, "/games", body => body.includes(gameId));
    await pollFor(page, `/games/${gameId}`, body => body.includes(gameId));
    await pollFor(page, "/sitemap.xml", body => body.includes(gameId));

    const del = await request.delete("/api/admin/games", { data: { gameId } });
    expect(del.ok()).toBeTruthy();

    await pollFor(page, "/games", body => !body.includes(gameId));
  });
});
