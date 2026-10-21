/**
 * e2e/season-roster-enrollment.spec.js
 *
 * Tests for the Season Roster Enrollment feature:
 *   GET + PUT /api/admin/roster-entries
 *   Season rows and the season sheet's roster checklist on /admin/[slug]/seasons
 *
 * Auth strategy: inject a real HMAC-signed session cookie (SESSION_SECRET) so
 * the page's SSR treats the request as signed in. All data APIs are mocked so
 * tests are fully self-contained (no live DB required).
 *
 * Do NOT use waitForLoadState("networkidle"). Next.js dev HMR keeps a
 * WebSocket open that prevents networkidle from ever firing.
 */
import { test, expect } from "@playwright/test";
import { makeAdminAuth } from "./helpers/admin-auth.js";

const ADMIN_SLUG     = process.env.ADMIN_SLUG     ?? null;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "";

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
  await page.context().addCookies(makeAdminAuth().cookies);
  // A successful PUT replaces the season's entries, so the list refetch sees the saved state.
  let entries = [...ENTRIES];
  await page.route("**/api/admin/seasons-list",  route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ seasons: SEASONS }) }));
  await page.route("**/api/admin/leagues-list",  route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leagues: [] }) }));
  // Regex rather than a glob: this page asks for ?includeArchived=true, and a
  // glob has to match the whole URL including the query. A missed match falls
  // through to the real route and the page renders empty.
  await page.route(/\/api\/admin\/season-leagues(\?|$)/, route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ seasonLeagues: SEASON_LEAGUES }) }));
  await page.route("**/api/admin/players",       route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ players: PLAYERS }) }));
  await page.route("**/api/admin/roster-entries", route => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ entries }) });
    }
    if (route.request().method() === "PUT") {
      if (putResponse) return route.fulfill(putResponse);
      const { seasonId, playerIds } = route.request().postDataJSON();
      entries = [...entries.filter(e => e.seasonId !== seasonId), ...playerIds.map(playerId => ({ seasonId, playerId }))];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, enrolled: playerIds.length }) });
    }
    return route.fulfill({ status: 405, contentType: "application/json", body: "{}" });
  });
}

async function goToSeasons(page, slug) {
  await page.goto(`/admin/${slug}/seasons`);
  await expect(page.getByRole("button", { name: /2025-26/ })).toBeVisible({ timeout: 10_000 });
}

// Archived seasons stay out of the list until Show all is on.
async function openSeason(page, name) {
  if (name === "2024-25") await page.getByRole("button", { name: "Show all (1 archived)" }).click();
  await page.getByRole("button", { name }).click();
  const sheet = page.getByRole("dialog", { name });
  await expect(sheet).toBeVisible();
  return sheet;
}

const saveButton = (sheet) => sheet.getByRole("button", { name: "SAVE", exact: true });

// ── Season rows ──────────────────────────────────────────────────────────────

test.describe("Seasons page › rows", () => {
  test("shows a row per current season, with archived ones behind Show all", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    await expect(page.getByRole("button", { name: /2026-27/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /2024-25/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Show all (1 archived)" }).click();
    await expect(page.getByRole("button", { name: /2024-25/ })).toContainText("Archived");
  });

  test("a row shows its game, league and enrolled player counts", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    await expect(page.getByRole("button", { name: /2025-26/ })).toContainText("10 games · 1 league · 2 players");
    await expect(page.getByRole("button", { name: /2026-27/ })).toContainText("0 games · 0 leagues · 0 players");
  });
});

// ── Season sheet roster ──────────────────────────────────────────────────────

test.describe("Season sheet › roster checklist", () => {
  test("opening a row shows the roster count and every player sorted by jersey number", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    const sheet = await openSeason(page, "2025-26");
    await expect(sheet.getByRole("heading", { name: "Roster (2 of 3)" })).toBeVisible();
    await expect(sheet.getByRole("checkbox")).toHaveCount(PLAYERS.length);
    const labels = await sheet.locator("label").filter({ has: page.locator("input[type='checkbox']") }).allInnerTexts();
    expect(labels.map(l => l.split("\n")[0])).toEqual(["#7 John Doe", "#10 Jane Smith", "#23 Bob Wilson"]);
  });

  test("enrolled players are checked, unenrolled are unchecked", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    const sheet = await openSeason(page, "2025-26");
    await expect(sheet.getByLabel(/#7 /)).toBeChecked();
    await expect(sheet.getByLabel(/#10 /)).toBeChecked();
    await expect(sheet.getByLabel(/#23 /)).not.toBeChecked();
  });

  test("a season with no linked league shows the empty state instead of a checklist", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    const sheet = await openSeason(page, "2026-27");
    await expect(sheet.getByText("Link a league to this season first.")).toBeVisible();
    await expect(sheet.getByRole("checkbox")).toHaveCount(0);
  });

  test("an archived season lists its enrolled players read-only, with save disabled", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    const sheet = await openSeason(page, "2024-25");
    await expect(sheet.getByRole("heading", { name: "Roster (3 of 3)" })).toBeVisible();
    await expect(sheet.getByRole("checkbox")).toHaveCount(0);
    for (const p of PLAYERS) {
      await expect(sheet.getByRole("listitem").filter({ hasText: `#${p.number} ${p.name}` })).toBeVisible();
    }
    await expect(saveButton(sheet)).toBeDisabled();
  });
});

// ── Dirty tracking and save ──────────────────────────────────────────────────

test.describe("Season sheet › save", () => {
  test("save is disabled when no changes are pending", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    const sheet = await openSeason(page, "2025-26");
    await expect(saveButton(sheet)).toBeDisabled();
  });

  test("toggling a player enables save, and toggling back disables it again", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    const sheet = await openSeason(page, "2025-26");
    await sheet.getByLabel(/#23 /).check();
    await expect(sheet.getByRole("heading", { name: "Roster (3 of 3)" })).toBeVisible();
    await expect(saveButton(sheet)).toBeEnabled();
    await sheet.getByLabel(/#23 /).uncheck();
    await expect(saveButton(sheet)).toBeDisabled();
  });

  test("save sends PUT with the seasonId and playerIds, and no PATCH when the dates are untouched", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    await mockSeasonsApis(page);
    let patched = false;
    await page.route(/\/api\/admin\/seasons\/[^/]+$/, route => { patched = true; return route.fulfill({ json: {} }); });
    await goToSeasons(page, ADMIN_SLUG);

    const sheet = await openSeason(page, "2025-26");
    await sheet.getByLabel(/#23 /).check();

    // Capture the PUT before clicking. waitForRequest fires on dispatch, before routing
    const putPromise = page.waitForRequest(req =>
      req.method() === "PUT" && req.url().includes("roster-entries")
    );
    await saveButton(sheet).click();
    const body = JSON.parse((await putPromise).postData() ?? "{}");

    expect(body.seasonId).toBe("s1");
    expect(body.playerIds).toHaveLength(3);
    expect(body.playerIds).toContain("p3");
    expect(patched).toBe(false);
  });

  test("a successful save closes the sheet and the row shows the new player count", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    await mockSeasonsApis(page);
    await goToSeasons(page, ADMIN_SLUG);

    const row = page.getByRole("button", { name: /2025-26/ });
    await expect(row).toContainText("2 players");
    const sheet = await openSeason(page, "2025-26");
    await sheet.getByLabel(/#23 /).check();
    await saveButton(sheet).click();

    await expect(sheet).not.toBeVisible({ timeout: 5_000 });
    await expect(row).toContainText("3 players");
  });

  test("an error response shows inside the sheet and leaves the draft intact", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    await mockSeasonsApis(page, {
      putResponse: { status: 400, contentType: "application/json", body: JSON.stringify({ error: "Invalid player ID" }) },
    });
    await goToSeasons(page, ADMIN_SLUG);

    const sheet = await openSeason(page, "2025-26");
    await sheet.getByLabel(/#23 /).check();
    await saveButton(sheet).click();

    await expect(sheet.getByRole("alert")).toContainText("Invalid player ID", { timeout: 5_000 });
    await expect(sheet.getByLabel(/#23 /)).toBeChecked();
    await expect(saveButton(sheet)).toBeEnabled();
    await sheet.getByRole("button", { name: "CLOSE", exact: true }).click();
    await expect(page.getByRole("button", { name: /2025-26/ })).toContainText("2 players");
  });
});

// ── API auth guards (no browser, no credentials needed) ─────────────────────

test.describe("roster-entries API › auth guards", () => {
  test("GET /api/admin/roster-entries returns 401 without a session", async ({ request }) => {
    const res = await request.get("/api/admin/roster-entries");
    expect(res.status()).toBe(401);
  });

  test("PUT /api/admin/roster-entries returns 401 without a session", async ({ request }) => {
    const res = await request.put("/api/admin/roster-entries", { data: { seasonId: "x", playerIds: [] } });
    expect([401, 403]).toContain(res.status());
  });
});
