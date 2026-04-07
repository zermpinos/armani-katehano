# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public.spec.js >> Homepage (/) >> renders the hero / record section without crashing
- Location: e2e/public.spec.js:32:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

```

# Test source

```ts
  1   | /**
  2   |  * e2e/public.spec.js
  3   |  * E2E tests for public-facing pages.
  4   |  *
  5   |  * These tests verify that pages render without crashing and key structural
  6   |  * elements are present -- they are intentionally resilient to empty DB state
  7   |  * (no games / no players yet).
  8   |  */
  9   | import { test, expect } from "@playwright/test";
  10  | 
  11  | // ─── Homepage ─────────────────────────────────────────────────────────────────
  12  | 
  13  | test.describe("Homepage (/)", () => {
  14  |   test("loads without a 500 error", async ({ page }) => {
  15  |     const response = await page.goto("/");
  16  |     expect(response.status()).not.toBe(500);
  17  |     expect(response.status()).not.toBe(404);
  18  |   });
  19  | 
  20  |   test("renders the page title", async ({ page }) => {
  21  |     await page.goto("/");
  22  |     await expect(page).toHaveTitle(/Armani Katehano/i);
  23  |   });
  24  | 
  25  |   test("renders navigation links", async ({ page }) => {
  26  |     await page.goto("/");
  27  |     // Layout nav should have links to main sections
  28  |     await expect(page.getByRole("link", { name: /games/i })).toBeVisible();
  29  |     await expect(page.getByRole("link", { name: /leaderboard/i })).toBeVisible();
  30  |   });
  31  | 
  32  |   test("renders the hero / record section without crashing", async ({ page }) => {
> 33  |     await page.goto("/");
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
  34  |     // Page should contain at least one heading or stat element
  35  |     const body = await page.textContent("body");
  36  |     expect(body.length).toBeGreaterThan(50);
  37  |     // No JS error dialog
  38  |     const errors = [];
  39  |     page.on("pageerror", e => errors.push(e.message));
  40  |     await page.waitForLoadState("networkidle");
  41  |     expect(errors).toHaveLength(0);
  42  |   });
  43  | });
  44  | 
  45  | // ─── Games page ───────────────────────────────────────────────────────────────
  46  | 
  47  | test.describe("Games page (/games)", () => {
  48  |   test("loads without a 500 error", async ({ page }) => {
  49  |     const response = await page.goto("/games");
  50  |     expect(response.status()).not.toBe(500);
  51  |   });
  52  | 
  53  |   test("renders the page title", async ({ page }) => {
  54  |     await page.goto("/games");
  55  |     await expect(page).toHaveTitle(/games/i);
  56  |   });
  57  | 
  58  |   test("renders a season selector", async ({ page }) => {
  59  |     await page.goto("/games");
  60  |     // SeasonSelector component renders a select or button group
  61  |     const body = await page.textContent("body");
  62  |     expect(body).toMatch(/\d{4}/); // at least one year visible
  63  |   });
  64  | 
  65  |   test("no JS errors on load", async ({ page }) => {
  66  |     const errors = [];
  67  |     page.on("pageerror", e => errors.push(e.message));
  68  |     await page.goto("/games");
  69  |     await page.waitForLoadState("networkidle");
  70  |     expect(errors).toHaveLength(0);
  71  |   });
  72  | });
  73  | 
  74  | // ─── Leaderboard page ─────────────────────────────────────────────────────────
  75  | 
  76  | test.describe("Leaderboard page (/leaderboard)", () => {
  77  |   test("loads without a 500 error", async ({ page }) => {
  78  |     const response = await page.goto("/leaderboard");
  79  |     expect(response.status()).not.toBe(500);
  80  |   });
  81  | 
  82  |   test("renders the page title", async ({ page }) => {
  83  |     await page.goto("/leaderboard");
  84  |     await expect(page).toHaveTitle(/leaderboard/i);
  85  |   });
  86  | 
  87  |   test("no JS errors on load", async ({ page }) => {
  88  |     const errors = [];
  89  |     page.on("pageerror", e => errors.push(e.message));
  90  |     await page.goto("/leaderboard");
  91  |     await page.waitForLoadState("networkidle");
  92  |     expect(errors).toHaveLength(0);
  93  |   });
  94  | });
  95  | 
  96  | // ─── Players page ─────────────────────────────────────────────────────────────
  97  | 
  98  | test.describe("Players page (/players)", () => {
  99  |   test("loads without a 500 error", async ({ page }) => {
  100 |     const response = await page.goto("/players");
  101 |     expect(response.status()).not.toBe(500);
  102 |   });
  103 | 
  104 |   test("no JS errors on load", async ({ page }) => {
  105 |     const errors = [];
  106 |     page.on("pageerror", e => errors.push(e.message));
  107 |     await page.goto("/players");
  108 |     await page.waitForLoadState("networkidle");
  109 |     expect(errors).toHaveLength(0);
  110 |   });
  111 | });
  112 | 
  113 | // ─── 404 page ─────────────────────────────────────────────────────────────────
  114 | 
  115 | test.describe("404 page", () => {
  116 |   test("returns 404 for unknown routes", async ({ page }) => {
  117 |     const response = await page.goto("/this-page-does-not-exist");
  118 |     expect(response.status()).toBe(404);
  119 |   });
  120 | 
  121 |   test("renders inside the layout (not a blank page)", async ({ page }) => {
  122 |     await page.goto("/this-page-does-not-exist");
  123 |     // Layout nav should still be present
  124 |     const body = await page.textContent("body");
  125 |     expect(body.length).toBeGreaterThan(20);
  126 |   });
  127 | });
  128 | 
  129 | // ─── Navigation between pages ─────────────────────────────────────────────────
  130 | 
  131 | test.describe("Navigation", () => {
  132 |   test("clicking Games nav link navigates to /games", async ({ page }) => {
  133 |     await page.goto("/");
```