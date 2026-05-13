/**
 * e2e/games-modal.spec.js
 * E2E tests for the games page box score modal.
 *
 * The games page uses getStaticProps (server-side) for the game card list,
 * so card data comes from the real DB. The box score is fetched client-side
 * via GET /api/games/[id] when a card is clicked -- that request IS interceptable
 * with page.route().
 *
 * Tests that depend on a game card existing in the DB will self-skip when the
 * DB has no games (fresh environment / CI without seed data).
 */
import { test, expect } from "@playwright/test";

const MOCK_BOX_SCORE = {
  boxScore: [
    {
      pid: "clp1xxxxxxxxxxxxxxxxxxxx",
      min: 32, pts: 22, reb: 5, orb: 1, drb: 4, ast: 4, stl: 2, blk: 0,
      tov: 1, pf: 2, fgm: 9, fga: 18, fg2m: 6, fg2a: 11, fg3m: 3, fg3a: 7,
      ftm: 1, fta: 2, eff: 24,
    },
  ],
};

/**
 * Finds the first clickable game card on the /games page.
 * Returns the Locator for the card's <button>, or null if no games exist.
 */
async function findFirstGameCard(page) {
  // Game cards are <button> elements containing "BOX SCORE ->"
  const cards = page.getByText("BOX SCORE ->");
  const count = await cards.count();
  if (count === 0) return null;
  // Return the parent button of the first match
  return cards.first().locator("xpath=ancestor::button").first();
}

test.describe("Games page box score modal", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the client-side box score fetch for ANY game ID.
    // getStaticProps data (game card list) comes from the real DB -- we cannot
    // intercept that with page.route().
    await page.route("**/api/games/**", route =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify(MOCK_BOX_SCORE),
      })
    );
  });

  test("game card is visible when the DB has games", async ({ page }) => {
    await page.goto("/games");
    await page.waitForLoadState("networkidle");

    const card = await findFirstGameCard(page);
    test.skip(card === null, "No games in DB -- skipping modal tests");

    await expect(card).toBeVisible();
  });

  test("clicking a game card opens the box score modal", async ({ page }) => {
    await page.goto("/games");
    await page.waitForLoadState("networkidle");

    const card = await findFirstGameCard(page);
    test.skip(card === null, "No games in DB -- skipping modal tests");

    await card.click();

    // Modal backdrop appears (fixed overlay -- uses Tailwind `fixed` class, not inline style)
    await expect(page.locator("div.fixed").first())
      .toBeVisible({ timeout: 8000 });
  });

  test("box score modal shows stat column headers", async ({ page }) => {
    await page.goto("/games");
    await page.waitForLoadState("networkidle");

    const card = await findFirstGameCard(page);
    test.skip(card === null, "No games in DB -- skipping modal tests");

    await card.click();

    // Box score table has stat column headers
    await expect(page.getByText("PTS").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("EFF").first()).toBeVisible({ timeout: 8000 });
  });

  test("pressing × closes the box score modal", async ({ page }) => {
    await page.goto("/games");
    await page.waitForLoadState("networkidle");

    const card = await findFirstGameCard(page);
    test.skip(card === null, "No games in DB -- skipping modal tests");

    await card.click();

    // Wait for the close button to appear
    const closeBtn = page.getByRole("button", { name: "×" });
    await expect(closeBtn).toBeVisible({ timeout: 8000 });

    // TEMP DIAGNOSTIC (remove after root-causing PW 1.60 "outside of viewport" failure).
    // Captures actual DOM geometry at click time so we can tell whether the button is
    // genuinely off-viewport or Playwright is mis-reporting it.
    const diag = await closeBtn.evaluate(el => {
      const r = el.getBoundingClientRect();
      let scrollAncestor = el.parentElement;
      while (scrollAncestor && scrollAncestor !== document.body) {
        const cs = getComputedStyle(scrollAncestor);
        if (/(auto|scroll|overlay)/.test(cs.overflowY) || /(auto|scroll|overlay)/.test(cs.overflow)) break;
        scrollAncestor = scrollAncestor.parentElement;
      }
      const sa = scrollAncestor && scrollAncestor !== document.body
        ? {
            tag:          scrollAncestor.tagName,
            cls:          scrollAncestor.className,
            scrollTop:    scrollAncestor.scrollTop,
            scrollHeight: scrollAncestor.scrollHeight,
            clientHeight: scrollAncestor.clientHeight,
          }
        : null;
      return {
        rect:           { top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width, height: r.height },
        viewport:       { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
        scroll:         { x: window.scrollX, y: window.scrollY },
        bodyOverflow:   document.body.style.overflow,
        htmlOverflow:   document.documentElement.style.overflow,
        position:       getComputedStyle(el).position,
        visibility:     getComputedStyle(el).visibility,
        display:        getComputedStyle(el).display,
        scrollAncestor: sa,
      };
    });
    // eslint-disable-next-line no-console
    console.log("[diag close-button geometry]", JSON.stringify(diag, null, 2));

    await closeBtn.click();

    // Modal close button should disappear once modal is gone
    await expect(closeBtn).not.toBeVisible({ timeout: 5000 });
  });

  test("the /api/games/[id] endpoint is called when a card is clicked", async ({ page }) => {
    await page.goto("/games");
    await page.waitForLoadState("networkidle");

    const card = await findFirstGameCard(page);
    test.skip(card === null, "No games in DB -- skipping modal tests");

    let boxScoreRequested = false;
    page.on("request", req => {
      if (req.url().includes("/api/games/")) boxScoreRequested = true;
    });

    await card.click();
    // Give the fetch time to fire
    await page.waitForTimeout(500);

    expect(boxScoreRequested).toBe(true);
  });
});
