/**
 * e2e/admin.spec.js
 * E2E tests for the admin panel.
 *
 * Key implementation notes:
 * - Login form tests: test the unauthenticated UI; no credentials required.
 * - Authenticated dashboard tests: seed a real HMAC-signed session cookie
 *   (SESSION_SECRET) so the real GET /api/auth returns 200 with no login flow.
 * - Passkey test: injects a real HMAC-signed session + CSRF cookie pair (using
 *   SESSION_SECRET, the same key the server uses) directly into the browser
 *   context so passkey-registration APIs pass requireAuth without a real login.
 * - Do NOT use waitForLoadState("networkidle") - Next.js dev mode keeps a
 *   WebSocket open for HMR which prevents networkidle from ever firing.
 * - The passkey button text is "SIGN IN WITH PASSKEY".
 */
import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import { makeCsrfToken } from "./helpers/admin-auth.js";

const BASE_URL              = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const ADMIN_SLUG            = process.env.ADMIN_SLUG            ?? null;
const SESSION_SECRET        = process.env.SESSION_SECRET        ?? "";

// Resolve the test admin username: prefer explicit env var, then fall back to
// the first entry in ADMIN_USERS (if set), then "admin". Must be a real admin
// user so getAdminUser() in auth-verify doesn't return null (orphan rejection).
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

/**
 * Set the CSRF cookie directly via document.cookie so it is accessible to
 * getCsrfToken() (document.cookie, not HttpOnly). Must be called after a
 * page.goto so the document origin is set correctly.
 */
async function setCsrfCookie(page, csrfToken) {
  await page.evaluate((token) => {
    document.cookie = `__Host-ak_csrf=${token}; Secure; SameSite=Strict; Path=/`;
  }, csrfToken);
}

// ── Login form structure ───────────────────────────────────────────────────

test.describe("Admin panel › Login form", () => {
  test("shows the passkey login form when not authenticated", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");

    await page.goto(`/admin/${ADMIN_SLUG}/`);
    // SSR renders the login form for a request without a session
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "SIGN IN WITH PASSKEY" })).toBeVisible();
  });

  test("shows an error when passkey authentication fails", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");

    // Mock auth-options to return 401 - simulates server-side auth failure
    // without triggering a real WebAuthn ceremony.
    await page.route("**/api/auth/passkey/auth-options", async route => {
      return route.fulfill({
        status:      401,
        contentType: "application/json",
        body:        JSON.stringify({ error: "Authentication failed" }),
      });
    });

    await page.goto(`/admin/${ADMIN_SLUG}/`);
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "SIGN IN WITH PASSKEY" }).click();

    // Client sets loginError -> "Authentication failed. Try again."
    await expect(page.getByText(/authentication failed/i)).toBeVisible({ timeout: 8_000 });
  });

  test("shows lockout message after too many passkey attempts (mocked 429)", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");

    // Mock auth-options to return 429 - tests that the UI renders a rate-limit
    // message. The actual lockout enforcement is covered in the integration tests.
    await page.route("**/api/auth/passkey/auth-options", async route => {
      return route.fulfill({
        status:      429,
        contentType: "application/json",
        body:        JSON.stringify({ error: "Too many requests", retryAfter: 60 }),
      });
    });

    await page.goto(`/admin/${ADMIN_SLUG}/`);
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "SIGN IN WITH PASSKEY" }).click();

    await expect(page.getByText(/too many|try again/i)).toBeVisible({ timeout: 5_000 });
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

// ── Passkey authentication ─────────────────────────────────────────────────

test.describe("passkey login", () => {
  // Virtual WebAuthn authenticator via Chrome DevTools Protocol.
  // Uses cookie injection (SESSION_SECRET) to reach the passkeys page without
  // a real password login, then tests the full passkey register → sign-out →
  // sign-in flow end-to-end.
  test("admin can register and authenticate with a passkey", async ({ browser }) => {
    test.skip(!!process.env.PLAYWRIGHT_BASE_URL,
      "WebAuthn rpID must equal the page origin; an ephemeral preview host cannot match the rpID derived from NEXT_PUBLIC_APP_URL, so this runs locally only");
    test.skip(!ADMIN_SLUG || !SESSION_SECRET,
      "ADMIN_SLUG or SESSION_SECRET not configured");

    // One session value for both cookies: the CSRF token is bound to it.
    const sessionValue = makeSessionCookieValue(ADMIN_USERNAME);
    const context = await browser.newContext({
      baseURL:      BASE_URL,
      // Seed a valid server-side session so we can reach the passkeys page without
      // a real password login. The session is HMAC-signed with SESSION_SECRET so
      // requireAuth accepts it. storageState bypasses CDP's __Host- cookie validation.
      storageState: makeAdminStorageState(ADMIN_USERNAME, sessionValue),
    });
    const page    = await context.newPage();
    const cdp     = await context.newCDPSession(page);

    // Enable virtual authenticator environment
    await cdp.send("WebAuthn.enable", { enableUI: false });

    // Add a virtual authenticator (internal, user-verifying)
    const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol:                    "ctap2",
        transport:                   "internal",
        hasResidentKey:              true,
        hasUserVerification:         true,
        isUserVerified:              true,
        automaticPresenceSimulation: true,
      },
    });

    // Step 2: Navigate to passkeys page and register a new passkey.
    // Set the CSRF cookie after navigation (document.cookie is origin-scoped
    // and __Host- cookies with domain attrs aren't exposed, so we set it here).
    const csrfToken = makeCsrfToken(sessionValue);
    await page.goto(`/admin/${ADMIN_SLUG}/passkeys`);
    await expect(page.getByText("AK Admin").first()).toBeVisible({ timeout: 10_000 });
    await setCsrfCookie(page, csrfToken);
    // Intercept register-options/register-verify requests to log CSRF state
    const regLog = [];
    page.on("request", req => {
      if (req.url().includes("/api/auth/passkey/register")) {
        const hdr = req.headers()["x-csrf-token"] ?? "(none)";
        regLog.push(`→ ${req.url().split("/").pop()} X-CSRF-Token: ${hdr.slice(0,8)}...`);
      }
    });
    page.on("response", resp => {
      if (resp.url().includes("/api/auth/passkey/register")) {
        regLog.push(`← ${resp.url().split("/").pop()} ${resp.status()}`);
      }
    });
    await page.fill('input[placeholder="Device label"]', "E2E Test Key");
    await page.click('button:has-text("ADD PASSKEY")');
    // Wait for registration to complete (either success or failure)
    await page.waitForTimeout(8_000);
    console.log("[register flow]", regLog);
    const csrfAfterReg = await page.evaluate(() => document.cookie.match(/__Host-ak_csrf=([^;]+)/)?.[1] ?? "(none)");
    console.log("[CSRF cookie after register]", csrfAfterReg?.slice(0, 8) + "...");
    console.log("[csrfToken first 8]", csrfToken.slice(0, 8) + "...");
    await page.waitForSelector('text=E2E Test Key', { timeout: 5_000 });

    // Step 3: Sign out via the sidebar button
    await page.click('button:has-text("Sign out")');

    // Step 4: Sign in with the just-registered passkey
    // Virtual authenticator handles the WebAuthn ceremony automatically.
    const signInLog = [];
    page.on("response", resp => {
      if (resp.url().includes("/api/auth")) signInLog.push(`${resp.request().method()} ${resp.url().replace(BASE_URL, "")} → ${resp.status()}`);
    });
    await page.goto(`/admin/${ADMIN_SLUG}`);
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
    await page.click('button:has-text("SIGN IN WITH PASSKEY")');
    await page.waitForTimeout(6_000);
    console.log("[sign-in API calls]", signInLog);
    await expect(page.locator("text=AK Admin").first()).toBeVisible({ timeout: 10_000 });

    // Cleanup
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await context.close();
  });
});
