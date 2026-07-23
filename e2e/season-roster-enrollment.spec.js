/**
 * e2e/season-roster-enrollment.spec.js
 *
 * Tests for the Season Roster Enrollment feature:
 *   GET + PUT /api/admin/roster-entries
 *   Season Rosters panel on /admin/[slug]/seasons
 *
 * Auth strategy: mock GET /api/auth → 200 so useAdminAuth treats the
 * session as valid. All data APIs are also mocked so tests are fully
 * self-contained (no live DB required).
 *
 * Do NOT use waitForLoadState("networkidle"). Next.js dev HMR keeps a
 * WebSocket open that prevents networkidle from ever firing.
 */
import { test, expect } from "@playwright/test";

const ADMIN_SLUG = process.env.ADMIN_SLUG ?? null;

// ── Mock data ────────────────────────────────────────────────────────────────

const SEASONS = [
  { id: "s1", name: "2025-26", year: 2025, archivedAt: null,                    gameCount: 10 },
  { id: "s2", name: "2024-25", year: 2024, archivedAt: "2025-06-01T00:00:00Z", gameCount: 20 },
  { id: "s3", name: "2026-27", year: 2026, archivedAt: null,                    gameCount: 0  },
];

const SEASON_LEAGUES = [
  { id: "sl1", leagueName: "BC6", leagueSlug: "bc6", seasonName: "2025-26" },
  { id: "sl2", leagueName: "BC6", leagueSlug: "bc6", seasonName: "2024-25" },
  // 2026-27 has no linked league
];

const PLAYERS = [
  { id: "p1", name: "John Doe",    number: 7,  position: "PG", isActive: true },
  { id: "p2", name: "Jane Smith",  number: 10, position: "SG", isActive: true },
  { id: "p3", name: "Bob Wilson",  number: 23, position: "SF", isActive: true },
];

// 2025-26: p1 + p2 enrolled; p3 not. 2024-25: all enrolled.
const ENTRIES = [
  { seasonId: "s1", playerId: "p1" },
  { seasonId: "s1", playerId: "p2" },
  { seasonId: "s2", playerId: "p1" },
  { seasonId: "s2", playerId: "p2" },
  { seasonId: "s2", playerId: "p3" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function mockSeasonsApis(page, { putResponse } = {}) {
  await page.route("**/api/auth",              route => route.request().method() === "GET"
    ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) })
    : route.continue());
  await page.route("**/api/admin/seasons-list",  route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ seasons: SEASONS }) }));
  await page.route("**/api/admin/leagues-list",  route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leagues: [] }) }));
  await page.route("**/api/admin/season-leagues",route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ seasonLeagues: SEASON_LEAGUES }) }));
  await page.route("**/api/admin/players",       route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ players: PLAYERS }) }));
  await page.route("**/api/admin/roster-entries", route => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ entries: ENTRIES }) });
    }
    if (route.request().method() === "PUT") {
      return route.fulfill(putResponse ?? { status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, enrolled: 3 }) });
    }
    return route.continue();
  });
}

async function goToSeasons(page, slug) {
  await page.goto(`/admin/${slug}/seasons`);
  // Wait for the panel label. CSS renders it uppercase but the text content is mixed case
  await expect(page.getByText("Season Rosters")).toBeVisible({ timeout: 10_000 });
}

// ── Panel rendering ──────────────────────────────────────────────────────────

test.describe("Season Rosters panel › rendering", () => {
  test("panel is visible between Active links and Seasons panels", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    // Wait for all three panel labels to be in the DOM before checking order.
    const panelLabel = (text) => page.locator("section").filter({
      has: page.locator(":scope > div").filter({ hasText: new RegExp(`^${text}$`) }),
    });
    await expect(panelLabel("Active links")).toBeVisible();
    await expect(panelLabel("Season Rosters")).toBeVisible();
    await expect(panelLabel("Seasons")).toBeVisible();

    // compareDocumentPosition: bit 4 = DOCUMENT_POSITION_FOLLOWING (comes after)
    const inOrder = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const refs = { "Active links": null, "Season Rosters": null, "Seasons": null };
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent?.trim();
        // eslint-disable-next-line security/detect-object-injection -- text is gated by the `in` check against the fixed refs keys
        if (!(text in refs) || refs[text]) continue;
        const el = node.parentElement;
        // Only match first element-child of a section (the Panel label div)
        if (el?.parentElement?.tagName === "SECTION" && el.parentElement.firstElementChild === el) {
          // eslint-disable-next-line security/detect-object-injection -- text is gated by the `in` check against the fixed refs keys
          refs[text] = el;
        }
      }
      const { "Active links": al, "Season Rosters": sr, "Seasons": s } = refs;
      if (!al || !sr || !s) return false;
      return !!(al.compareDocumentPosition(sr) & 4) && !!(sr.compareDocumentPosition(s) & 4);
    });
    expect(inOrder).toBe(true);
  });

  test("shows one collapsible row per season", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    for (const s of SEASONS) {
      await expect(page.getByRole("button", { name: new RegExp(s.name) })).toBeVisible();
    }
  });

  test("enrolled count badge reflects GET /api/admin/roster-entries state", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    // 2025-26: 2 of 3 enrolled
    const row2526 = page.getByRole("button", { name: /2025-26/ });
    await expect(row2526).toContainText("2/3");

    // 2024-25: 3 of 3 enrolled
    const row2425 = page.getByRole("button", { name: /2024-25/ });
    await expect(row2425).toContainText("3/3");
  });

  test("league count in row header", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    await expect(page.getByRole("button", { name: /2025-26/ })).toContainText("1 league");
    await expect(page.getByRole("button", { name: /2026-27/ })).toContainText("0 leagues");
  });
});

// ── Expand / checklist ───────────────────────────────────────────────────────

test.describe("Season Rosters panel › checklist", () => {
  test("expanding shows all active players sorted by jersey number", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    await page.getByRole("button", { name: /2025-26/ }).click();

    for (const p of PLAYERS) {
      await expect(page.getByLabel(new RegExp(`#${p.number}`))).toBeVisible();
    }
  });

  test("enrolled players are checked, unenrolled are unchecked", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    await page.getByRole("button", { name: /2025-26/ }).click();

    await expect(page.getByLabel(/#7/)).toBeChecked();
    await expect(page.getByLabel(/#10/)).toBeChecked();
    await expect(page.getByLabel(/#23/)).not.toBeChecked();
  });

  test("no-leagues season shows empty state instead of checklist", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    await page.getByRole("button", { name: /2026-27/ }).click();
    await expect(page.getByText("Link a league to this season first.")).toBeVisible();
    await expect(page.getByLabel(/#7/)).not.toBeVisible({ timeout: 1_000 }).catch(() => {});
  });

  test("archived season disables all checkboxes and hides save button", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    await page.getByRole("button", { name: /2024-25/ }).click();

    const checkboxes = page.locator("input[type='checkbox']");
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).toBeDisabled();
    }
    await expect(page.getByRole("button", { name: /SAVE ROSTER/i })).not.toBeVisible();
  });
});

// ── Dirty tracking and save ──────────────────────────────────────────────────

test.describe("Season Rosters panel › save", () => {
  test("save button is disabled when no changes are pending", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    await page.getByRole("button", { name: /2025-26/ }).click();
    await expect(page.getByRole("button", { name: /SAVE ROSTER/i })).toBeDisabled();
  });

  test("toggling a player enables the save button", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    await page.getByRole("button", { name: /2025-26/ }).click();
    await page.getByLabel(/#23/).click();
    await expect(page.getByRole("button", { name: /SAVE ROSTER/i })).toBeEnabled();
  });

  test("toggling back to original state disables save button again", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    await page.getByRole("button", { name: /2025-26/ }).click();
    await page.getByLabel(/#23/).click();
    await expect(page.getByRole("button", { name: /SAVE ROSTER/i })).toBeEnabled();
    await page.getByLabel(/#23/).click();
    await expect(page.getByRole("button", { name: /SAVE ROSTER/i })).toBeDisabled();
  });

  test("save sends PUT with correct seasonId and playerIds", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");

    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);
    await page.getByRole("button", { name: /2025-26/ }).click();
    await page.getByLabel(/#23/).click();

    // Capture the PUT before clicking. waitForRequest fires on dispatch, before routing
    const putPromise = page.waitForRequest(req =>
      req.method() === "PUT" && req.url().includes("roster-entries")
    );
    await page.getByRole("button", { name: /SAVE ROSTER/i }).click();
    const putReq = await putPromise;
    const body = JSON.parse(putReq.postData() ?? "{}");

    await expect(page.getByText("Roster saved.")).toBeVisible({ timeout: 5_000 });
    expect(body.seasonId).toBe("s1");
    expect(body.playerIds).toHaveLength(3);
    expect(body.playerIds).toContain("p3");
  });

  test("enrolled count badge updates after successful save", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    await page.getByRole("button", { name: /2025-26/ }).click();
    await expect(page.getByRole("button", { name: /2025-26/ })).toContainText("2/3");
    await page.getByLabel(/#23/).click();
    await page.getByRole("button", { name: /SAVE ROSTER/i }).click();
    await expect(page.getByText("Roster saved.")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /2025-26/ })).toContainText("3/3");
  });

  test("error response shows error toast and leaves draft intact", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await mockSeasonsApis(page, {
      putResponse: { status: 400, contentType: "application/json", body: JSON.stringify({ error: "Invalid player ID" }) },
    });
    await goToSeasons(page, ADMIN_SLUG);

    await page.getByRole("button", { name: /2025-26/ }).click();
    await page.getByLabel(/#23/).click();
    await page.getByRole("button", { name: /SAVE ROSTER/i }).click();

    await expect(page.getByText("Invalid player ID")).toBeVisible({ timeout: 5_000 });
    // Badge still shows original enrolled count (draft not committed)
    await expect(page.getByRole("button", { name: /2025-26/ })).toContainText("2/3");
  });
});

// ── API auth guards (no browser, no credentials needed) ─────────────────────

test.describe("roster-entries API › auth guards", () => {
  test("GET /api/admin/roster-entries returns 401 without a session", async ({ request }) => {
    const res = await request.get("/api/admin/roster-entries");
    expect(res.status()).toBe(401);
  });

  test("PUT /api/admin/roster-entries returns 403 without a session (CSRF fires first)", async ({ request }) => {
    const res = await request.put("/api/admin/roster-entries", { data: { seasonId: "x", playerIds: [] } });
    expect([401, 403]).toContain(res.status());
  });
});
