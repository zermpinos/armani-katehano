# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: games-modal.spec.js >> Games page box score modal >> pressing × closes the box score modal
- Location: e2e/games-modal.spec.js:91:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/games
Call log:
  - navigating to "http://localhost:3000/games", waiting until "load"

```

# Test source

```ts
  1   | /**
  2   |  * e2e/games-modal.spec.js
  3   |  * E2E tests for the games page box score modal.
  4   |  *
  5   |  * The games page uses getStaticProps (server-side) for the game card list,
  6   |  * so card data comes from the real DB. The box score is fetched client-side
  7   |  * via GET /api/games/[id] when a card is clicked — that request IS interceptable
  8   |  * with page.route().
  9   |  *
  10  |  * Tests that depend on a game card existing in the DB will self-skip when the
  11  |  * DB has no games (fresh environment / CI without seed data).
  12  |  */
  13  | import { test, expect } from "@playwright/test";
  14  | 
  15  | const MOCK_BOX_SCORE = {
  16  |   boxScore: [
  17  |     {
  18  |       pid: "clp1xxxxxxxxxxxxxxxxxxxx",
  19  |       min: 32, pts: 22, reb: 5, orb: 1, drb: 4, ast: 4, stl: 2, blk: 0,
  20  |       tov: 1, pf: 2, fgm: 9, fga: 18, fg2m: 6, fg2a: 11, fg3m: 3, fg3a: 7,
  21  |       ftm: 1, fta: 2, eff: 24,
  22  |     },
  23  |   ],
  24  | };
  25  | 
  26  | /**
  27  |  * Finds the first clickable game card on the /games page.
  28  |  * Returns the Locator for the card's <button>, or null if no games exist.
  29  |  */
  30  | async function findFirstGameCard(page) {
  31  |   // Game cards are <button> elements containing "BOX SCORE →"
  32  |   const cards = page.getByText("BOX SCORE →");
  33  |   const count = await cards.count();
  34  |   if (count === 0) return null;
  35  |   // Return the parent button of the first match
  36  |   return cards.first().locator("xpath=ancestor::button").first();
  37  | }
  38  | 
  39  | test.describe("Games page box score modal", () => {
  40  |   test.beforeEach(async ({ page }) => {
  41  |     // Mock the client-side box score fetch for ANY game ID.
  42  |     // getStaticProps data (game card list) comes from the real DB — we cannot
  43  |     // intercept that with page.route().
  44  |     await page.route("**/api/games/**", route =>
  45  |       route.fulfill({
  46  |         status:      200,
  47  |         contentType: "application/json",
  48  |         body:        JSON.stringify(MOCK_BOX_SCORE),
  49  |       })
  50  |     );
  51  |   });
  52  | 
  53  |   test("game card is visible when the DB has games", async ({ page }) => {
  54  |     await page.goto("/games");
  55  |     await page.waitForLoadState("networkidle");
  56  | 
  57  |     const card = await findFirstGameCard(page);
  58  |     test.skip(card === null, "No games in DB — skipping modal tests");
  59  | 
  60  |     await expect(card).toBeVisible();
  61  |   });
  62  | 
  63  |   test("clicking a game card opens the box score modal", async ({ page }) => {
  64  |     await page.goto("/games");
  65  |     await page.waitForLoadState("networkidle");
  66  | 
  67  |     const card = await findFirstGameCard(page);
  68  |     test.skip(card === null, "No games in DB — skipping modal tests");
  69  | 
  70  |     await card.click();
  71  | 
  72  |     // Modal backdrop appears (fixed overlay)
  73  |     await expect(page.locator("div[style*='position:fixed'], div[style*='position: fixed']").first())
  74  |       .toBeVisible({ timeout: 8000 });
  75  |   });
  76  | 
  77  |   test("box score modal shows stat column headers", async ({ page }) => {
  78  |     await page.goto("/games");
  79  |     await page.waitForLoadState("networkidle");
  80  | 
  81  |     const card = await findFirstGameCard(page);
  82  |     test.skip(card === null, "No games in DB — skipping modal tests");
  83  | 
  84  |     await card.click();
  85  | 
  86  |     // Box score table has stat column headers
  87  |     await expect(page.getByText("PTS").first()).toBeVisible({ timeout: 8000 });
  88  |     await expect(page.getByText("EFF").first()).toBeVisible({ timeout: 8000 });
  89  |   });
  90  | 
  91  |   test("pressing × closes the box score modal", async ({ page }) => {
> 92  |     await page.goto("/games");
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/games
  93  |     await page.waitForLoadState("networkidle");
  94  | 
  95  |     const card = await findFirstGameCard(page);
  96  |     test.skip(card === null, "No games in DB — skipping modal tests");
  97  | 
  98  |     await card.click();
  99  | 
  100 |     // Wait for the close button to appear
  101 |     const closeBtn = page.getByRole("button", { name: "×" });
  102 |     await expect(closeBtn).toBeVisible({ timeout: 8000 });
  103 |     await closeBtn.click();
  104 | 
  105 |     // Modal close button should disappear once modal is gone
  106 |     await expect(closeBtn).not.toBeVisible({ timeout: 5000 });
  107 |   });
  108 | 
  109 |   test("the /api/games/[id] endpoint is called when a card is clicked", async ({ page }) => {
  110 |     await page.goto("/games");
  111 |     await page.waitForLoadState("networkidle");
  112 | 
  113 |     const card = await findFirstGameCard(page);
  114 |     test.skip(card === null, "No games in DB — skipping modal tests");
  115 | 
  116 |     let boxScoreRequested = false;
  117 |     page.on("request", req => {
  118 |       if (req.url().includes("/api/games/")) boxScoreRequested = true;
  119 |     });
  120 | 
  121 |     await card.click();
  122 |     // Give the fetch time to fire
  123 |     await page.waitForTimeout(500);
  124 | 
  125 |     expect(boxScoreRequested).toBe(true);
  126 |   });
  127 | });
  128 | 
```