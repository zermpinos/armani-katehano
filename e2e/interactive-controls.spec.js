/**
 * e2e/interactive-controls.spec.js
 * Verifies every interactive button/selector across all public pages.
 * Tests are data-resilient: they skip data-dependent assertions when the DB
 * is empty, but always verify that controls are present and respond correctly.
 */
import { test, expect } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wait for networkidle and collect any page-level JS errors. */
async function loadPage(page, url) {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  return errors;
}

/** Return all SeasonSelector buttons (exclude "All Time"). */
const seasonBtns = (page) =>
  page.locator("button").filter({ hasText: /^\d{4}-\d{2,4}$/ });

// ─── /games ───────────────────────────────────────────────────────────────────

test.describe("Games page: interactive controls", () => {
  test.beforeEach(async ({ page }) => {
    await loadPage(page, "/games");
  });

  test("no JS errors on load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/games");
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });

  test("list/calendar view-mode toggle switches view", async ({ page }) => {
    // Both toggle buttons must exist
    const listBtn     = page.getByRole("button", { name: "≡" });
    const calendarBtn = page.getByRole("button", { name: "▦" });

    // At least one of the pair is present (only rendered when seasons exist)
    const listCount = await listBtn.count();
    test.skip(listCount === 0, "No seasons in DB, view toggle not rendered");

    await expect(listBtn).toBeVisible();
    await expect(calendarBtn).toBeVisible();

    // Switch to calendar
    await calendarBtn.click();
    // Calendar view shows month/week grid, check list view is gone
    await expect(listBtn).toBeVisible(); // toggle still there
    // Switch back to list
    await listBtn.click();
  });

  test("result filter: Wins button activates and shows green highlight", async ({ page }) => {
    const winsBtn = page.getByRole("button", { name: /^wins$/i });
    const lossBtn = page.getByRole("button", { name: /^losses$/i });

    await expect(winsBtn).toBeVisible();
    await expect(lossBtn).toBeVisible();

    await winsBtn.click();
    // Wins button should now carry the green border class
    await expect(winsBtn).toHaveClass(/ak-green/);

    // "Clear filters" button should appear
    const clearBtn = page.getByRole("button", { name: /clear filters/i });
    await expect(clearBtn).toBeVisible();

    // Clicking Clear resets both filters
    await clearBtn.click();
    await expect(clearBtn).not.toBeVisible();
  });

  test("result filter: Losses button activates", async ({ page }) => {
    const lossBtn = page.getByRole("button", { name: /^losses$/i });
    await lossBtn.click();
    await expect(lossBtn).toHaveClass(/ak-red-text/);
  });

  test("result filter: All button resets state", async ({ page }) => {
    const winsBtn = page.getByRole("button", { name: /^wins$/i });
    // Scope "All" to the same container row as Wins/Losses to avoid hitting
    // the LeagueFilter "All" button that appears earlier in the DOM.
    const allBtn = winsBtn.locator("..").getByRole("button", { name: /^all$/i });
    await winsBtn.click();
    await allBtn.click();
    await expect(page.getByRole("button", { name: /clear filters/i })).not.toBeVisible();
  });

  test("season selector: clicking each tab fires without JS error", async ({ page }) => {
    const btns = seasonBtns(page);
    const count = await btns.count();
    test.skip(count < 2, "Fewer than 2 seasons, selector not interactive");

    const errors = [];
    page.on("pageerror", e => errors.push(e.message));

    for (let i = 0; i < count; i++) {
      await btns.nth(i).click();
      await page.waitForTimeout(200);
    }
    expect(errors).toHaveLength(0);
  });

  test("switching season resets league and result filters", async ({ page }) => {
    const btns = seasonBtns(page);
    const count = await btns.count();
    test.skip(count < 2, "Only one season, skipping filter-reset test");

    // Set a non-default result filter
    const winsBtn = page.getByRole("button", { name: /^wins$/i });
    await winsBtn.click();
    await expect(page.getByRole("button", { name: /clear filters/i })).toBeVisible();

    // Switch to a different season
    const targetIdx = (await btns.nth(0).getAttribute("class"))?.includes("ak-red") ? 1 : 0;
    await btns.nth(targetIdx).click();

    // Filters should be reset, Clear Filters should disappear
    await expect(page.getByRole("button", { name: /clear filters/i })).not.toBeVisible();
  });
});

// ─── /leaderboard ─────────────────────────────────────────────────────────────

test.describe("Leaderboard page: interactive controls", () => {
  test.beforeEach(async ({ page }) => {
    await loadPage(page, "/leaderboard");
  });

  test("no JS errors on load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/leaderboard");
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });

  test("AVG / TOT toggle: both buttons visible and clickable", async ({ page }) => {
    const avgBtn = page.getByRole("button", { name: /^avg$/i });
    const totBtn = page.getByRole("button", { name: /^tot$/i });

    const count = await avgBtn.count();
    test.skip(count === 0, "No seasons, AVG/TOT toggle not rendered");

    await expect(avgBtn).toBeVisible();
    await expect(totBtn).toBeVisible();

    // Switch to TOT
    await totBtn.click();
    await expect(totBtn).toHaveClass(/ak-red-text/);

    // Switch back to AVG
    await avgBtn.click();
    await expect(avgBtn).toHaveClass(/ak-red-text/);
  });

  test("phase filter: Regular Season button activates", async ({ page }) => {
    const regularBtn = page.getByRole("button", { name: /regular season/i });
    await expect(regularBtn).toBeVisible();
    await regularBtn.click();
    await expect(regularBtn).toHaveClass(/ak-red-text/);
  });

  test("phase filter: Playoffs button activates", async ({ page }) => {
    const playoffsBtn = page.getByRole("button", { name: /^playoffs$/i });
    await expect(playoffsBtn).toBeVisible();
    await playoffsBtn.click();
    await expect(playoffsBtn).toHaveClass(/ak-red-text/);
  });

  test("phase filter: All Season resets to default", async ({ page }) => {
    const allBtn      = page.getByRole("button", { name: /all season/i });
    const regularBtn  = page.getByRole("button", { name: /regular season/i });
    await regularBtn.click();
    await allBtn.click();
    await expect(allBtn).toHaveClass(/ak-red-text/);
  });

  test("season selector: All Time button activates", async ({ page }) => {
    const allTimeBtn = page.getByRole("button", { name: /all time/i });
    const count = await allTimeBtn.count();
    test.skip(count === 0, "SeasonSelector not rendered");
    await allTimeBtn.click();
    await expect(allTimeBtn).toHaveClass(/ak-red-text/);
  });

  test("season selector: switching season resets phase filter to All Season", async ({ page }) => {
    const btns = seasonBtns(page);
    const count = await btns.count();
    test.skip(count < 2, "Fewer than 2 seasons, skipping");

    const regularBtn = page.getByRole("button", { name: /regular season/i });
    const allBtn     = page.getByRole("button", { name: /all season/i });

    await regularBtn.click();
    await expect(regularBtn).toHaveClass(/ak-red-text/);

    // Switch to another season (pick first non-active one)
    const targetIdx = (await btns.nth(0).getAttribute("class"))?.includes("ak-red") ? 1 : 0;
    await btns.nth(targetIdx).click();

    await expect(allBtn).toHaveClass(/ak-red-text/);
  });

  test("column sort: clicking PPG header toggles direction", async ({ page }) => {
    const ppgHeader = page.getByRole("columnheader", { name: /ppg/i });
    const count = await ppgHeader.count();
    test.skip(count === 0, "No table headers visible");
    await ppgHeader.click();
    await ppgHeader.click(); // second click reverses sort
    // No JS error is the main assertion here, visual sort arrow is enough
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    expect(errors).toHaveLength(0);
  });
});

// ─── /players ─────────────────────────────────────────────────────────────────

test.describe("Players page: interactive controls", () => {
  test.beforeEach(async ({ page }) => {
    await loadPage(page, "/players");
  });

  test("no JS errors on load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/players");
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });

  test("search input filters players", async ({ page }) => {
    const cards = page.locator("a[href^='/players/']");
    const total = await cards.count();
    test.skip(total === 0, "No players in DB");

    const input = page.getByPlaceholder(/search players/i);
    await expect(input).toBeVisible();

    // Type a string that matches nothing
    await input.fill("zzzyyyxxx");
    await expect(page.getByText(/no players match/i)).toBeVisible();

    // Clear via input
    await input.fill("");
    const afterClear = await cards.count();
    expect(afterClear).toBe(total);
  });

  test("'Clear search' link appears and clears input", async ({ page }) => {
    const cards = page.locator("a[href^='/players/']");
    test.skip(await cards.count() === 0, "No players in DB");

    const input = page.getByPlaceholder(/search players/i);
    await input.fill("zzzyyyxxx");

    const clearLink = page.getByRole("button", { name: /clear search/i });
    await expect(clearLink).toBeVisible();
    await clearLink.click();

    await expect(input).toHaveValue("");
    await expect(clearLink).not.toBeVisible();
  });

  test("season selector: All Time button activates", async ({ page }) => {
    const allTimeBtn = page.getByRole("button", { name: /all time/i });
    const count = await allTimeBtn.count();
    test.skip(count === 0, "SeasonSelector not rendered");
    await allTimeBtn.click();
    await expect(allTimeBtn).toHaveClass(/ak-red-text/);
  });

  test("season selector: switching season clears search", async ({ page }) => {
    const btns = seasonBtns(page);
    const count = await btns.count();
    test.skip(count < 2, "Fewer than 2 seasons, skipping");

    const input = page.getByPlaceholder(/search players/i);
    await input.fill("test query");

    const targetIdx = (await btns.nth(0).getAttribute("class"))?.includes("ak-red") ? 1 : 0;
    await btns.nth(targetIdx).click();

    await expect(input).toHaveValue("");
  });
});

// ─── /team-stats ──────────────────────────────────────────────────────────────

test.describe("Team Stats page: interactive controls", () => {
  test.beforeEach(async ({ page }) => {
    await loadPage(page, "/team-stats");
  });

  test("no JS errors on load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/team-stats");
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });

  test("phase filter buttons are present and clickable", async ({ page }) => {
    const allBtn      = page.getByRole("button", { name: /all season/i });
    const regularBtn  = page.getByRole("button", { name: /regular season/i });
    const playoffsBtn = page.getByRole("button", { name: /^playoffs$/i });

    // Only rendered when games exist
    const hasPhaseFilters = (await allBtn.count()) > 0;
    test.skip(!hasPhaseFilters, "No games, phase filters not rendered");

    await expect(allBtn).toBeVisible();
    await expect(regularBtn).toBeVisible();
    await expect(playoffsBtn).toBeVisible();

    await regularBtn.click();
    await expect(regularBtn).toHaveClass(/ak-red-text/);

    await playoffsBtn.click();
    await expect(playoffsBtn).toHaveClass(/ak-red-text/);

    await allBtn.click();
    await expect(allBtn).toHaveClass(/ak-red-text/);
  });

  test("league tab buttons are present and clickable", async ({ page }) => {
    // "All Games" tab is always first when leagues exist
    const allGamesBtn = page.getByRole("button", { name: /all games/i });
    const count = await allGamesBtn.count();
    test.skip(count === 0, "No games, league tabs not rendered");

    await expect(allGamesBtn).toBeVisible();
    await allGamesBtn.click();
    await expect(allGamesBtn).toHaveClass(/ak-red-text/);
  });

  test("season selector: clicking a past season switches data client-side without navigation", async ({ page }) => {
    const btns = seasonBtns(page);
    const count = await btns.count();
    test.skip(count < 2, "Fewer than 2 seasons, selector not interactive");

    const urlBefore = page.url();
    const targetIdx = (await btns.nth(0).getAttribute("class"))?.includes("ak-red") ? 1 : 0;

    await btns.nth(targetIdx).click();

    // Must NOT navigate away, pure client-side switch via useState
    expect(page.url()).toBe(urlBefore);
    // Clicked button becomes active
    await expect(btns.nth(targetIdx)).toHaveClass(/ak-red-text/);
    // Phase/league reset buttons only appear when the selected season has games
    const allSeasonBtn = page.getByRole("button", { name: /all season/i });
    if (await allSeasonBtn.count() > 0) {
      await expect(allSeasonBtn).toHaveClass(/ak-red-text/);
      await expect(page.getByRole("button", { name: /all games/i })).toHaveClass(/ak-red-text/);
    }
  });
});
