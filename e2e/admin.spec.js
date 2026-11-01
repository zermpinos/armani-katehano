/**
 * e2e/admin.spec.js
 * E2E tests for the admin panel.
 *
 * Key implementation notes:
 * - Login form tests: test the unauthenticated UI; no credentials required.
 * - Authenticated dashboard tests: seed a real HMAC-signed session cookie
 *   (SESSION_SECRET) so the real GET /api/auth returns 200 with no login flow.
 * - Do NOT use waitForLoadState("networkidle") - Next.js dev mode keeps a
 *   WebSocket open for HMR which prevents networkidle from ever firing.
 */
import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";

const BASE_URL              = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const ADMIN_SLUG            = process.env.ADMIN_SLUG            ?? null;
const SESSION_SECRET        = process.env.SESSION_SECRET        ?? "";

// Resolve the test admin username: prefer explicit env var, then fall back to
// the first entry in ADMIN_USERS (if set), then "admin".
// ADMIN_USERS may have \$ in bcrypt hashes (dotenv unquoted-value escaping);
// replace \$ → $ so JSON.parse doesn't throw on the invalid escape sequence.
const ADMIN_USERNAME = (() => {
  if (process.env.E2E_ADMIN_USERNAME) return process.env.E2E_ADMIN_USERNAME;
  try {
    const raw   = (process.env.ADMIN_USERS ?? "").replace(/\\\$/g, "$");
    const users = JSON.parse(raw);
    if (Array.isArray(users) && users[0]?.username) return users[0].username;
  } catch { /* fall through */ }
  return "admin";
})();

// ── Cookie helpers ─────────────────────────────────────────────────────────

/**
 * Generate a valid HMAC-signed session cookie value using the same signing
 * logic the server uses (src/server/auth/session.ts#signSession).
 */
function makeSessionCookieValue(username = "admin") {
  const payload = JSON.stringify({ ts: Date.now(), role: "admin", user: username });
  const data    = Buffer.from(payload).toString("base64url");
  const sig     = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Build a storageState object with a valid HMAC-signed admin session cookie.
 * The __Host-ak_session cookie is HttpOnly, so it must be injected via
 * storageState (not document.cookie). The companion CSRF cookie is NOT included
 * here; it is set via page.evaluate after navigation because __Host- cookies
 * with a domain attribute are not exposed via document.cookie in Chrome.
 */
function makeAdminStorageState(username = ADMIN_USERNAME, sessionValue = makeSessionCookieValue(username)) {
  const host = new URL(BASE_URL).hostname;
  return {
    cookies: [
      {
        name:     "__Host-ak_session",
        value:    sessionValue,
        domain:   host,
        path:     "/",
        secure:   true,
        httpOnly: true,
        sameSite: "Strict",
        expires:  -1,
      },
    ],
    origins: [],
  };
}

// ── Login form structure ───────────────────────────────────────────────────

test.describe("Admin panel › Login form", () => {
  const signIn = async (page) => {
    await page.goto(`/admin/${ADMIN_SLUG}/`);
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder("Enter username").fill("e2e-user");
    await page.getByPlaceholder("Enter password").fill("e2e-wrong-password");
    await page.getByRole("button", { name: "SIGN IN" }).click();
  };

  test("shows the username and password form when not authenticated", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");

    await page.goto(`/admin/${ADMIN_SLUG}/`);
    // SSR renders the login form for a request without a session
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder("Enter username")).toBeVisible();
    await expect(page.getByPlaceholder("Enter password")).toBeVisible();
    await expect(page.getByPlaceholder("6-digit code")).toHaveCount(0);
  });

  test("shows the server's error and sends only username, password and slug (mocked 401)", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");

    let sentBody;
    await page.route("**/api/auth", async route => {
      if (route.request().method() !== "POST") return route.continue();
      sentBody = route.request().postDataJSON();
      return route.fulfill({
        status:      401,
        contentType: "application/json",
        body:        JSON.stringify({ error: "Invalid credentials" }),
      });
    });

    await signIn(page);

    await expect(page.getByText("Invalid credentials")).toBeVisible({ timeout: 8_000 });
    expect(sentBody).toEqual({ username: "e2e-user", password: "e2e-wrong-password", slug: ADMIN_SLUG, captchaToken: null });
  });

  test("shows the lockout message after too many attempts (mocked 429)", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");

    // The lockout itself is covered in the integration tests.
    await page.route("**/api/auth", async route => {
      if (route.request().method() !== "POST") return route.continue();
      return route.fulfill({
        status:      429,
        contentType: "application/json",
        body:        JSON.stringify({ error: "Too many failed attempts. Try again later.", retryAfter: 900 }),
      });
    });

    await signIn(page);

    await expect(page.getByText(/too many attempts/i)).toBeVisible({ timeout: 5_000 });
  });
});

// Authenticated dashboard: seed a real signed session, no login flow needed.

test.describe("Admin panel › Authenticated dashboard", () => {
  const adminContext = (browser) => browser.newContext({
    baseURL:      BASE_URL,
    storageState: makeAdminStorageState(ADMIN_USERNAME),
  });

  test("a valid session shows the admin nav bar", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await page.goto(`/admin/${ADMIN_SLUG}/`);
      await expect(page.getByText("AK Admin").first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Admin Access")).not.toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("a valid session reaches the Games admin section", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await page.goto(`/admin/${ADMIN_SLUG}/games`);
      await page.waitForLoadState("load");
      await expect(page.getByText("Admin Access")).not.toBeVisible({ timeout: 5_000 });
      await expect(page.getByText("AK Admin").first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("logout via DELETE /api/auth brings the login form back", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await page.goto(`/admin/${ADMIN_SLUG}/`);
      await expect(page.getByText("AK Admin").first()).toBeVisible({ timeout: 10_000 });
      // DELETE takes no CSRF; it clears the session cookie directly.
      await page.evaluate(() => fetch("/api/auth", { method: "DELETE" }));
      await page.reload();
      await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });
});

test.describe("Admin panel › Persistent shell", () => {
  const adminContext = (browser) => browser.newContext({
    baseURL:      BASE_URL,
    storageState: makeAdminStorageState(ADMIN_USERNAME),
  });

  test("moving between sections makes no /api/auth call", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await page.goto(`/admin/${ADMIN_SLUG}/`);
      await expect(page.getByText("AK Admin").first()).toBeVisible({ timeout: 10_000 });
      const authCalls = [];
      page.on("request", req => { if (new URL(req.url()).pathname === "/api/auth") authCalls.push(req.url()); });
      await page.getByRole("link", { name: "Roster" }).first().click();
      await expect(page).toHaveURL(url => url.pathname === `/admin/${ADMIN_SLUG}/roster`);
      await page.getByRole("link", { name: "Schedule" }).first().click();
      await expect(page).toHaveURL(url => url.pathname === `/admin/${ADMIN_SLUG}/schedule`);
      expect(authCalls).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("a signed-out deep link shows the login form in place", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
    await page.goto(`/admin/${ADMIN_SLUG}/games`);
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(url => url.pathname === `/admin/${ADMIN_SLUG}/games`);
  });

  test("a session that dies mid-visit shows the sign-in overlay over the page", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await page.goto(`/admin/${ADMIN_SLUG}/roster`);
      await expect(page.getByText("AK Admin").first()).toBeVisible({ timeout: 10_000 });
      await context.clearCookies();
      await page.getByRole("link", { name: "Schedule" }).first().click();
      await expect(page.getByText("Your session expired")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("AK Admin").first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("admin inputs are at least 16px so phones do not zoom on focus", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await page.goto(`/admin/${ADMIN_SLUG}/schedule`);
      await page.getByRole("button", { name: "+ SCHEDULE GAME" }).click();
      const input = page.getByRole("dialog").locator("input").first();
      await expect(input).toBeVisible({ timeout: 10_000 });
      const size = await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(size).toBeGreaterThanOrEqual(16);
    } finally {
      await context.close();
    }
  });

  test("home is a launcher with the four tasks", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await page.goto(`/admin/${ADMIN_SLUG}/`);
      const tasks = page.getByRole("navigation", { name: "Tasks" });
      for (const name of ["Import game", "Schedule", "Roster", "Broadcast"]) {
        await expect(tasks.getByRole("link").filter({ hasText: name })).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });
});

test.describe("Admin panel › Schedule sheet", () => {
  const adminContext = (browser) => browser.newContext({
    baseURL:      BASE_URL,
    storageState: makeAdminStorageState(ADMIN_USERNAME),
  });
  const day = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const fixture = {
    id: "cmfixture0000000000000001", opponent: "Mock Opponent", scheduledFor: `${day}T20:00:00.000Z`,
    location: "home", competition: null, notes: null, sourceUrl: null,
  };

  async function mockSchedule(page, onWrite) {
    await page.route(url => url.pathname === "/api/admin/opponent-names", route => route.fulfill({ json: { waiting: [], names: [] } }));
    let rows = [fixture];
    await page.route("**/api/admin/schedule", async route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { schedule: rows } });
      const result = await onWrite(route.request());
      if (result.status < 300) rows = result.rows(rows);
      return route.fulfill({ status: result.status, json: result.body });
    });
  }

  test("editing a fixture saves in place without leaving the list", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await mockSchedule(page, req => {
        const body = req.postDataJSON();
        return { status: 200, body: { ok: true }, rows: rs => rs.map(r => (r.id === body.id ? { ...r, opponent: body.opponent } : r)) };
      });
      await page.goto(`/admin/${ADMIN_SLUG}/schedule`);
      await page.getByRole("button", { name: /Mock Opponent/ }).click();
      const sheet = page.getByRole("dialog", { name: "Edit fixture" });
      await expect(sheet).toBeVisible();
      await sheet.getByLabel("OPPONENT").fill("Renamed Opponent");
      await sheet.getByRole("button", { name: "SAVE CHANGES" }).click();
      await expect(sheet).toBeHidden();
      await expect(page.getByRole("button", { name: /Renamed Opponent/ })).toBeVisible();
      await expect(page).toHaveURL(url => url.pathname === `/admin/${ADMIN_SLUG}/schedule`);
    } finally {
      await context.close();
    }
  });

  test("a rejected save reopens the sheet with the server message and the draft", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await mockSchedule(page, () => ({ status: 400, body: { error: "sourceUrl host is not on the scraper allowlist" }, rows: rs => rs }));
      await page.goto(`/admin/${ADMIN_SLUG}/schedule`);
      await page.getByRole("button", { name: /Mock Opponent/ }).click();
      const sheet = page.getByRole("dialog", { name: "Edit fixture" });
      await sheet.getByLabel("OPPONENT").fill("Draft Opponent");
      await sheet.getByRole("button", { name: "SAVE CHANGES" }).click();
      await expect(sheet.getByRole("alert")).toHaveText("sourceUrl host is not on the scraper allowlist");
      await expect(sheet.getByLabel("OPPONENT")).toHaveValue("Draft Opponent");
    } finally {
      await context.close();
    }
  });

  test("Cancel returns focus to the row", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await mockSchedule(page, () => ({ status: 500, body: { error: "no writes expected" }, rows: rs => rs }));
      await page.goto(`/admin/${ADMIN_SLUG}/schedule`);
      await page.getByRole("button", { name: /Mock Opponent/ }).click();
      const sheet = page.getByRole("dialog", { name: "Edit fixture" });
      await expect(sheet).toBeVisible();
      await sheet.getByRole("button", { name: "CANCEL" }).click();
      await expect(sheet).toBeHidden();
      await expect(page.getByRole("button", { name: /Mock Opponent/ })).toBeFocused();
    } finally {
      await context.close();
    }
  });

  test("Save returns focus to the row while the write is in flight", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await mockSchedule(page, async req => {
        await new Promise(resolve => setTimeout(resolve, 500));
        const body = req.postDataJSON();
        return { status: 200, body: { ok: true }, rows: rs => rs.map(r => (r.id === body.id ? { ...r, opponent: body.opponent } : r)) };
      });
      await page.goto(`/admin/${ADMIN_SLUG}/schedule`);
      await page.getByRole("button", { name: /Mock Opponent/ }).click();
      const sheet = page.getByRole("dialog", { name: "Edit fixture" });
      await sheet.getByLabel("OPPONENT").fill("Focus Opponent");
      await sheet.getByRole("button", { name: "SAVE CHANGES" }).click();
      await expect(sheet).toBeHidden();
      await expect(page.getByRole("button", { name: /Focus Opponent/ })).toBeFocused();
    } finally {
      await context.close();
    }
  });
});

test.describe("Admin panel › Roster sheet", () => {
  const adminContext = (browser) => browser.newContext({
    baseURL:      BASE_URL,
    storageState: makeAdminStorageState(ADMIN_USERNAME),
  });
  const players = [
    { id: "cmplayer00000000000000001", name: "Mock Player",    number: 7, position: "SG", height: null, weight: null, photoUrl: null, contactEmail: null, isActive: true },
    { id: "cmplayer00000000000000002", name: "Retired Player", number: 9, position: "C",  height: null, weight: null, photoUrl: null, contactEmail: null, isActive: false },
  ];

  async function mockRoster(page, onPut) {
    await page.route("**/api/admin/players*", async route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { players } });
      const result = onPut(route.request());
      return route.fulfill({ status: result.status, json: result.body });
    });
    await page.route("**/api/admin/roster-entries*", route => route.fulfill({ json: { leagues: [] } }));
  }

  test("retired players stay behind show all", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await mockRoster(page, () => ({ status: 200, body: { ok: true } }));
      await page.goto(`/admin/${ADMIN_SLUG}/roster`);
      await expect(page.getByRole("button", { name: /Mock Player/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Retired Player/ })).toHaveCount(0);
      await page.getByRole("button", { name: "Show all (1 retired)" }).click();
      await expect(page.getByRole("button", { name: /Retired Player/ })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("a jersey clash reopens the sheet with the server message and the draft", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await mockRoster(page, () => ({ status: 409, body: { error: "Jersey #7 is already assigned to X." } }));
      await page.goto(`/admin/${ADMIN_SLUG}/roster`);
      await page.getByRole("button", { name: /Mock Player/ }).click();
      const sheet = page.getByRole("dialog", { name: "Edit player" });
      await sheet.getByLabel("FULL NAME").fill("Draft Name");
      await sheet.getByRole("button", { name: "SAVE CHANGES" }).click();
      await expect(sheet.getByRole("alert")).toHaveText("Jersey #7 is already assigned to X.");
      await expect(sheet.getByLabel("FULL NAME")).toHaveValue("Draft Name");
    } finally {
      await context.close();
    }
  });
});

test.describe("Admin panel › Import recovery", () => {
  const adminContext = (browser) => browser.newContext({
    baseURL:      BASE_URL,
    storageState: makeAdminStorageState(ADMIN_USERNAME),
  });
  const SOURCE = "https://basketcity.sportstats.gr/men/gamedetails/id/MOCK-GAME";
  const day = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  const fixture = {
    id: "cmfixture0000000000000002", opponent: "Mock Rivals", scheduledFor: `${day}T17:30:00.000Z`,
    location: "home", competition: "Mock League", notes: null, sourceUrl: SOURCE,
  };
  const players = [
    { id: "cmplayer00000000000000010", name: "Mock Owner",    number: 0, position: "PG", isActive: true },
    { id: "cmplayer00000000000000011", name: "Mock Borrower", number: 1, position: "SG", isActive: true },
    { id: "cmplayer00000000000000012", name: "Mock Bench",    number: 5, position: "C",  isActive: true },
    { id: "cmplayer00000000000000013", name: "Mock Starter",  number: 8, position: "SF", isActive: true },
  ];
  const zero = { min: 0, pts: 0, reb: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, eff: 0 };
  const borrowed = { ...zero, min: 23.35, pts: 11, reb: 5, orb: 3, drb: 2, pf: 4, fgm: 5, fga: 12, fg2m: 5, fg2a: 10, fg3a: 2, ftm: 1, fta: 2 };
  const starter  = { ...zero, min: 30, pts: 6, reb: 2, drb: 2, fgm: 3, fga: 6, fg2m: 3, fg2a: 6 };
  const guest    = { ...zero, min: 10, pts: 4, reb: 1, drb: 1, fgm: 2, fga: 3, fg2m: 2, fg2a: 3 };
  const scrape = {
    ok: true, data: {}, gameState: { state: "final", reason: "mock" }, gate: { ok: true, failures: [] },
    draft: {
      date: day, opponent: "Mock Rivals", home: true, result: "L", teamScore: 21, opponentScore: 30,
      seasonLeagueId: "cmseasonleague00000000001", sourceUrl: SOURCE,
      boxScore: [
        { playerId: players[0].id, ...borrowed },
        { playerId: players[1].id, ...zero },
        { playerId: players[2].id, ...zero },
        { playerId: players[3].id, ...starter },
      ],
    },
    highlights: {}, unresolved: [],
    unresolvedPlayers: [{ number: 44, name: "GUEST MOCK", line: guest }],
    nameMismatches:    [{ number: 0, scrapedName: "BORROWER MOCK", playerId: players[0].id }],
  };

  async function mockImport(page, onCommit = () => {}) {
    await page.route("**/api/admin/players*", route => route.fulfill({ json: { players } }));
    await page.route("**/api/admin/season-leagues*", route => route.fulfill({
      json: { seasonLeagues: [{ id: "cmseasonleague00000000001", leagueName: "Mock League", leagueSlug: "basketcity-mock", seasonName: "2026-27" }] },
    }));
    await page.route("**/api/admin/schedule*", route => route.fulfill({ json: { schedule: [fixture] } }));
    await page.route("**/api/admin/scrape", route => route.fulfill({ json: scrape }));
    await page.route("**/api/admin/import", route => {
      onCommit(route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { ok: true, gameId: "cmgame000000000000000001" } });
    });
  }

  test("a played fixture that was never imported is one tap from review", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await mockImport(page);
      await page.goto(`/admin/${ADMIN_SLUG}/import`);
      const size = await page.getByLabel("GAME URL").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(size).toBeGreaterThanOrEqual(16);
      const scraped = page.waitForRequest(req => req.url().endsWith("/api/admin/scrape"));
      await page.getByRole("button", { name: /Mock Rivals/ }).click();
      expect((await scraped).postDataJSON()).toEqual({ url: SOURCE });
    } finally {
      await context.close();
    }
  });

  test("a borrowed jersey's line moves to the player who wore it, hidden stats included", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      let committed = null;
      await mockImport(page, body => { committed = body; });
      await page.goto(`/admin/${ADMIN_SLUG}/import`);
      await page.getByRole("button", { name: /Mock Rivals/ }).click();
      const save = page.getByRole("button", { name: "SAVE GAME" });
      await expect(save).toBeDisabled();
      await page.getByLabel("PLAYER FOR #0").selectOption({ label: "#1 Mock Borrower" });
      await page.getByLabel("PLAYER FOR #44").selectOption({ label: "#5 Mock Bench" });
      await expect(save).toBeEnabled();
      await save.click();
      await expect.poll(() => committed).not.toBeNull();
      const row = id => committed.boxScore.find(r => r.playerId === id);
      expect(committed.boxScore).toHaveLength(4);
      expect(row(players[1].id)).toMatchObject({ played: true, pts: 11, orb: 3, drb: 2, pf: 4 });
      expect(row(players[0].id)).toMatchObject({ played: false, pts: 0, orb: 0, drb: 0, pf: 0 });
      expect(row(players[2].id)).toMatchObject({ played: true, pts: 4 });
    } finally {
      await context.close();
    }
  });
});

test.describe("Admin panel › Subscribers sheet", () => {
  const adminContext = (browser) => browser.newContext({
    baseURL:      BASE_URL,
    storageState: makeAdminStorageState(ADMIN_USERNAME),
  });
  const subscribers = [
    { id: "cmsubscriber0000000000001", email: "fan.one@example.com", createdAt: "2026-09-01T10:00:00.000Z", confirmedAt: "2026-09-01T10:05:00.000Z" },
    { id: "cmsubscriber0000000000002", email: "fan.two@example.com", createdAt: "2026-09-02T10:00:00.000Z", confirmedAt: null },
  ];

  async function mockSubscribers(page, deletes) {
    let list = [...subscribers];
    await page.route(url => url.pathname === "/api/admin/subscribers", async route => {
      if (route.request().method() === "GET") {
        return route.fulfill({ json: { subscribers: list, total: list.length, page: 1, limit: 50, hasMore: false } });
      }
      const { ids } = route.request().postDataJSON();
      deletes.push(ids);
      list = list.filter(s => !ids.includes(s.id));
      return route.fulfill({ json: { deleted: ids.length } });
    });
  }

  test("a subscriber is removed from its sheet only after a second tap", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      const deletes = [];
      await mockSubscribers(page, deletes);
      await page.goto(`/admin/${ADMIN_SLUG}/subscribers`);
      const search = page.getByLabel("SEARCH");
      await expect(search).toBeVisible();
      expect(await search.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);

      await page.getByRole("button", { name: /fan\.one@example\.com/ }).click();
      const sheet = page.getByRole("dialog", { name: "Subscriber" });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText("fan.one@example.com")).toBeVisible();

      await sheet.getByRole("button", { name: "REMOVE", exact: true }).click();
      await expect(sheet.getByRole("button", { name: "TAP AGAIN TO REMOVE" })).toBeVisible();
      expect(deletes).toEqual([]);

      await sheet.getByRole("button", { name: "TAP AGAIN TO REMOVE" }).click();
      await expect(sheet).toBeHidden();
      await expect(page.getByRole("button", { name: /fan\.one@example\.com/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /fan\.two@example\.com/ })).toBeVisible();
      expect(deletes).toEqual([["cmsubscriber0000000000001"]]);
    } finally {
      await context.close();
    }
  });

  test("a removal re-reads the page so the next subscriber moves up", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      let list = ["one", "two", "three"].map((n, i) => ({
        id: `cmsubscriber000000000000${i + 1}`, email: `fan.${n}@example.com`,
        createdAt: "2026-09-01T10:00:00.000Z", confirmedAt: "2026-09-01T10:05:00.000Z",
      }));
      const log = [];
      await page.route(url => url.pathname === "/api/admin/subscribers", async route => {
        const req = route.request();
        if (req.method() === "GET") {
          log.push(`GET ${new URL(req.url()).searchParams.get("page")}`);
          const more = list.length > 2;
          return route.fulfill({ json: {
            subscribers: more ? list.slice(0, 2) : list, total: list.length, page: 1, limit: 2, hasMore: more,
          } });
        }
        log.push("DELETE");
        const { ids } = req.postDataJSON();
        list = list.filter(s => !ids.includes(s.id));
        return route.fulfill({ json: { deleted: ids.length } });
      });
      await page.goto(`/admin/${ADMIN_SLUG}/subscribers`);
      await expect(page.getByRole("button", { name: /fan\.one@example\.com/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /fan\.two@example\.com/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /fan\.three@example\.com/ })).toHaveCount(0);

      await page.getByRole("button", { name: /fan\.one@example\.com/ }).click();
      const sheet = page.getByRole("dialog", { name: "Subscriber" });
      await sheet.getByRole("button", { name: "REMOVE", exact: true }).click();
      await sheet.getByRole("button", { name: "TAP AGAIN TO REMOVE" }).click();

      await expect(page.getByRole("button", { name: /fan\.three@example\.com/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /fan\.one@example\.com/ })).toHaveCount(0);
      expect(log).toEqual(["GET 1", "DELETE", "GET 1"]);
    } finally {
      await context.close();
    }
  });
});

test.describe("Admin panel › Broadcast composer", () => {
  const adminContext = (browser) => browser.newContext({
    baseURL:      BASE_URL,
    storageState: makeAdminStorageState(ADMIN_USERNAME),
  });

  async function mockBroadcast(page, posts) {
    await page.route(url => url.pathname === "/api/admin/broadcast", async route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { logs: [] } });
      const body = route.request().postDataJSON();
      posts.push(body.mode);
      if (body.mode === "preview") return route.fulfill({ json: { ok: true, renderedHtml: "<p>Hello <strong>fans</strong></p>" } });
      return route.fulfill({ status: 500, json: { error: "This test must not send." } });
    });
    await page.route(url => url.pathname === "/api/admin/subscribers", route => route.fulfill({
      json: { subscribers: [], total: 3, page: 1, limit: 1, hasMore: false },
    }));
  }

  test("review and send unlocks only for text that has a current preview", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      const posts = [];
      await mockBroadcast(page, posts);
      await page.goto(`/admin/${ADMIN_SLUG}/broadcast`);

      const subject = page.getByLabel("SUBJECT");
      const body    = page.getByLabel("BODY (MARKDOWN)");
      await subject.fill("Match night");
      await body.fill("Hello **fans**");
      for (const field of [subject, body]) {
        expect(await field.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
      }
      const review = page.getByRole("button", { name: "REVIEW & SEND" });
      await expect(review).toBeDisabled();

      await page.getByRole("button", { name: "Preview", exact: true }).click();
      await expect(page.getByText("No preview of this text yet.")).toBeVisible();
      await page.getByRole("button", { name: /SEND PREVIEW TO/ }).click();
      await expect(page.locator("strong", { hasText: "fans" })).toBeVisible();
      await expect(review).toBeEnabled();
      expect(posts).toEqual(["preview"]);

      await page.getByRole("button", { name: "Write", exact: true }).click();
      await page.getByLabel("BODY (MARKDOWN)").fill("Changed text");
      await expect(review).toBeDisabled();
      await page.getByRole("button", { name: "Preview", exact: true }).click();
      await expect(page.getByText("No preview of this text yet.")).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe("Admin panel › Opponent names", () => {
  const adminContext = (browser) => browser.newContext({
    baseURL:      BASE_URL,
    storageState: makeAdminStorageState(ADMIN_USERNAME),
  });
  const day = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  test("naming a waiting opponent publishes its fixture and clears the card", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      const log = [];
      let schedule = [];
      let waiting  = [{ scrapedName: "NY BRICKS", suggestion: "Ny Bricks", waitingOn: "fixture", dateText: "Κυριακή, 18 Οκτωβρίου 2026" }];
      await page.route(url => url.pathname === "/api/admin/schedule", route => {
        log.push("GET schedule");
        return route.fulfill({ json: { schedule } });
      });
      await page.route(url => url.pathname === "/api/admin/opponent-names", route => {
        if (route.request().method() === "GET") {
          return route.fulfill({ json: { waiting, names: ["Miami Bricks", "New York Bricks", "Prison Bricks"] } });
        }
        const body = route.request().postDataJSON();
        log.push(`POST ${body.scrapedName} -> ${body.displayName}`);
        waiting  = [];
        schedule = [{
          id: "cmfixture0000000000000002", opponent: body.displayName, scheduledFor: `${day}T22:30:00.000Z`,
          location: "away", competition: "Super League", notes: null, sourceUrl: "https://basketcity.sportstats.gr/men/gamedetails/id/MOCK-GAME",
        }];
        return route.fulfill({ status: 201, json: { ok: true, published: [{ opponent: body.displayName, scheduledFor: `${day}T22:30:00.000Z` }], syncError: null } });
      });

      await page.goto(`/admin/${ADMIN_SLUG}/schedule`);
      const card  = page.getByRole("region", { name: /Opponent names waiting/ });
      await expect(card).toBeVisible();
      const input = card.getByLabel("NAME FOR NY BRICKS");
      await expect(input).toHaveValue("Ny Bricks");
      expect(await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);

      await card.getByRole("button", { name: "New York Bricks", exact: true }).click();
      await expect(input).toHaveValue("New York Bricks");
      await card.getByRole("button", { name: "SAVE" }).click();

      await expect(card).toBeHidden();
      await expect(page.getByRole("button", { name: /New York Bricks/ })).toBeVisible();
      expect(log).toContain("POST NY BRICKS -> New York Bricks");
    } finally {
      await context.close();
    }
  });
});

test.describe("Admin panel › Games, seasons and settings", () => {
  const adminContext = (browser) => browser.newContext({
    baseURL:      BASE_URL,
    storageState: makeAdminStorageState(ADMIN_USERNAME),
  });

  const CURRENT_SL = { id: "cmslcurrent00000000000001", leagueName: "Super League", leagueSlug: "men", seasonName: "2026-27" };
  const OLDER_SL   = { id: "cmslolder0000000000000001", leagueName: "Super League", leagueSlug: "men", seasonName: "2025-26" };
  const CURRENT_GAME = {
    id: "cmgamecurrent000000000001", seasonLeagueId: CURRENT_SL.id, date: "2026-10-18", opponent: "Mock Current Rivals",
    home: false, result: "W", teamScore: 70, opponentScore: 60, round: "regular",
  };
  const OLDER_GAME = {
    id: "cmgameolder00000000000001", seasonLeagueId: OLDER_SL.id, date: "2026-04-12", opponent: "Mock Old Rivals",
    home: true, result: "L", teamScore: 55, opponentScore: 58, round: "semifinal",
  };
  const CURRENT_LIST = { currentSeason: "2026-27", games: [CURRENT_GAME], seasonLeagues: [CURRENT_SL], olderCount: 1 };
  const ALL_LIST     = { currentSeason: null, games: [CURRENT_GAME, OLDER_GAME], seasonLeagues: [CURRENT_SL, OLDER_SL], olderCount: 0 };
  const PLAYER_ID    = "cmplayer00000000000000001";
  const EDIT = {
    game: {
      ...OLDER_GAME, sourceUrl: null, youtubeUrl: null, notes: "Mock note",
      boxScore: [{
        playerId: PLAYER_ID, minutes: 20, pts: 9, reb: 4, orb: 1, drb: 3, ast: 2, stl: 0, blk: 0, tov: 1, pf: 2,
        fgm: 4, fga: 8, fg2m: 3, fg2a: 5, fg3m: 1, fg3a: 3, ftm: 0, fta: 0,
      }],
    },
    players:       [{ id: PLAYER_ID, name: "Mock Player", number: 7, position: "SG", isActive: true }],
    seasonLeagues: [OLDER_SL],
  };

  const mockData = (page) => page.route(url => url.pathname === "/api/admin/data", route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("gameId")) return route.fulfill({ json: EDIT });
    return route.fulfill({ json: params.get("all") === "1" ? ALL_LIST : CURRENT_LIST });
  });

  test("the games list shows the current season, and every season behind Show all", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await mockData(page);
      await page.goto(`/admin/${ADMIN_SLUG}/games`);
      await expect(page.getByText("1 in 2026-27")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Mock Current Rivals")).toBeVisible();
      await expect(page.getByText("Mock Old Rivals")).toHaveCount(0);

      await page.getByRole("button", { name: "Show all (1 older)" }).click();
      await expect(page.getByText("Mock Old Rivals")).toBeVisible();
      await expect(page.getByText("Semifinal", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: /Mock Old Rivals/ })).toContainText("Super League · 2025-26");
      await expect(page.getByRole("button", { name: "Show current only" })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("saving an older playoff game keeps its round and sends the edited notes", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      await mockData(page);
      let put = null;
      await page.route(url => url.pathname === "/api/admin/games", route => {
        if (route.request().method() !== "PUT") return route.fulfill({ status: 405, json: {} });
        put = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      });

      await page.goto(`/admin/${ADMIN_SLUG}/games/${OLDER_GAME.id}`);
      await expect(page.getByLabel("ROUND")).toHaveValue("semifinal", { timeout: 10_000 });
      await expect(page.getByLabel("DATE")).toHaveValue("2026-04-12");
      await expect(page.getByLabel("NOTES")).toHaveValue("Mock note");
      await expect(page.getByText("Player M.")).toBeVisible();

      await page.getByLabel("NOTES").fill("Edited note");
      await page.getByRole("button", { name: "SAVE CHANGES" }).click();
      await expect.poll(() => put?.round).toBe("semifinal");
      expect(put).toMatchObject({ notes: "Edited note", seasonLeagueId: OLDER_SL.id, location: "home" });
      expect(put.boxScore[0]).toMatchObject({ playerId: PLAYER_ID, minutes: 20, fgm: 4, fga: 8 });
    } finally {
      await context.close();
    }
  });

  test("the Phase 5 pages keep every text input at 16px or more", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !SESSION_SECRET, "ADMIN_SLUG or SESSION_SECRET not configured");
    const context = await adminContext(browser);
    const page    = await context.newPage();
    try {
      const pages = [
        ["games/new",   () => page.getByLabel("OPPONENT")],
        ["seasons",     () => page.getByRole("button", { name: "+ ADD SEASON" })],
        ["maintenance", () => page.getByLabel("PHASE")],
      ];
      for (const [path, ready] of pages) {
        await page.goto(`/admin/${ADMIN_SLUG}/${path}`);
        await expect(ready()).toBeVisible({ timeout: 10_000 });
        const sizes = await page.locator("main input:not([type=checkbox]), main select, main textarea")
          .evaluateAll(els => els.map(el => parseFloat(getComputedStyle(el).fontSize)));
        expect(sizes.length, path).toBeGreaterThan(0);
        expect(Math.min(...sizes), path).toBeGreaterThanOrEqual(16);
      }
    } finally {
      await context.close();
    }
  });
});

// ── API-level auth guard (always runs - no credentials needed) ─────────────

test.describe("Admin panel › API protection", () => {
  test("GET /api/admin/games returns 401 without a session cookie", async ({ request }) => {
    const res = await request.get("/api/admin/games");
    expect(res.status()).toBe(401);
  });

  test("POST /api/admin/games returns 401 without a session cookie", async ({ request }) => {
    const res = await request.post("/api/admin/games", { data: { opponent: "Test" } });
    // The session check runs first, so a bare API POST never reaches the CSRF check.
    expect(res.status()).toBe(401);
  });

  test("a wrong admin slug is a 404", async ({ request }) => {
    const res = await request.get("/admin/not-the-real-slug/games");
    expect(res.status()).toBe(404);
  });
});
