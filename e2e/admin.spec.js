/**
 * e2e/admin.spec.js
 * E2E tests for the admin panel.
 *
 * Key implementation notes:
 * - Login form tests: test the unauthenticated UI; no credentials required.
 * - Authenticated dashboard tests: /api/auth is mocked so they work regardless
 *   of the actual admin password configured in the environment.
 * - Passkey test: injects a real HMAC-signed session + CSRF cookie pair (using
 *   SESSION_SECRET, the same key the server uses) directly into the browser
 *   context so passkey-registration APIs pass requireAuth without a real login.
 * - Do NOT use waitForLoadState("networkidle") - Next.js dev mode keeps a
 *   WebSocket open for HMR which prevents networkidle from ever firing.
 * - The passkey button text is "SIGN IN WITH PASSKEY".
 * - The password fallback form button text is "SIGN IN".
 * - The password fallback form is only shown when the URL contains
 *   ?fallback=<PASSKEY_FALLBACK_TOKEN>.
 */
import { test, expect } from "@playwright/test";
import { createHmac, randomBytes } from "node:crypto";

const BASE_URL              = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const ADMIN_SLUG            = process.env.ADMIN_SLUG            ?? null;
const PASSKEY_FALLBACK_TOKEN = process.env.PASSKEY_FALLBACK_TOKEN ?? null;
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
function makeAdminStorageState(username = ADMIN_USERNAME) {
  const host = new URL(BASE_URL).hostname;
  return {
    cookies: [
      {
        name:     "__Host-ak_session",
        value:    makeSessionCookieValue(username),
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

// ── Auth mock helper ────────────────────────────────────────────────────────

/**
 * Mount a page-level mock for /api/auth that tracks login state in memory.
 * - GET  → 200 when logged in, 401 otherwise
 * - POST → always 200, records loggedIn = true
 * - DELETE → always 200, records loggedIn = false
 *
 * This lets the authenticated-dashboard tests work without knowing the real
 * admin password configured in the environment.
 */
async function mockAuth(page) {
  let loggedIn = false;
  await page.route("**/api/auth", async route => {
    const method = route.request().method();
    if (method === "POST") {
      loggedIn = true;
      return route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ ok: true }),
      });
    }
    if (method === "DELETE") {
      loggedIn = false;
      return route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ ok: true }),
      });
    }
    return route.fulfill({
      status:      loggedIn ? 200 : 401,
      contentType: "application/json",
      body:        JSON.stringify(loggedIn ? { ok: true } : { error: "Not authenticated" }),
    });
  });
}

/**
 * Navigate to the admin login page via the password fallback path and sign in.
 * The /api/auth endpoint is mocked so the test works regardless of the actual
 * admin password configured in the environment.
 */
async function loginViaFallback(page, slug, token, username, password) {
  await mockAuth(page);
  await page.goto(`/admin/${slug}/?fallback=${token}`);
  await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder("Enter username").fill(username);
  await page.locator("input[type='password']").fill(password);
  await page.getByRole("button", { name: "SIGN IN" }).click();
}

// ── Login form structure ───────────────────────────────────────────────────

test.describe("Admin panel › Login form", () => {
  test("shows the passkey login form when not authenticated", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");

    await page.goto(`/admin/${ADMIN_SLUG}/`);
    // Wait for React to hydrate and the GET /api/auth call to return 401
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

// ── Authenticated dashboard (auth mocked; no real credentials needed) ──────

test.describe("Admin panel › Authenticated dashboard", () => {
  test("logs in and shows the admin nav bar", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !PASSKEY_FALLBACK_TOKEN,
      "ADMIN_SLUG or PASSKEY_FALLBACK_TOKEN not configured");

    await loginViaFallback(page, ADMIN_SLUG, PASSKEY_FALLBACK_TOKEN, ADMIN_USERNAME, "mock-password");

    // After successful login, the admin nav bar renders with "AK Admin" branding
    await expect(page.getByText("AK Admin").first()).toBeVisible({ timeout: 10_000 });
    // Login form should be gone
    await expect(page.getByText("Admin Access")).not.toBeVisible();
  });

  test("can navigate to the Games admin section after login", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !PASSKEY_FALLBACK_TOKEN,
      "ADMIN_SLUG or PASSKEY_FALLBACK_TOKEN not configured");

    await loginViaFallback(page, ADMIN_SLUG, PASSKEY_FALLBACK_TOKEN, ADMIN_USERNAME, "mock-password");
    await expect(page.getByText("AK Admin").first()).toBeVisible({ timeout: 10_000 });

    // Navigate to the Games admin section via URL
    await page.goto(`/admin/${ADMIN_SLUG}/games`);
    await page.waitForLoadState("load");

    // The login form should NOT reappear - the mock keeps the session alive
    await expect(page.getByText("Admin Access")).not.toBeVisible({ timeout: 5_000 });
    // The nav bar should still be visible
    await expect(page.getByText("AK Admin").first()).toBeVisible();
  });

  test("logout via DELETE /api/auth makes the login form reappear", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !PASSKEY_FALLBACK_TOKEN,
      "ADMIN_SLUG or PASSKEY_FALLBACK_TOKEN not configured");

    await loginViaFallback(page, ADMIN_SLUG, PASSKEY_FALLBACK_TOKEN, ADMIN_USERNAME, "mock-password");
    await expect(page.getByText("AK Admin").first()).toBeVisible({ timeout: 10_000 });

    // Call the logout endpoint (mock handles DELETE → loggedIn=false)
    await page.evaluate(() => fetch("/api/auth", { method: "DELETE" }));

    // Reload - mock now returns 401, passkey login form should reappear
    await page.reload();
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
  });
});

// ── API-level auth guard (always runs - no credentials needed) ─────────────

test.describe("Admin panel › API protection", () => {
  test("GET /api/admin/games returns 401 without a session cookie", async ({ request }) => {
    const res = await request.get("/api/admin/games");
    expect(res.status()).toBe(401);
  });

  test("POST /api/admin/games returns 403 without a session cookie", async ({ request }) => {
    const res = await request.post("/api/admin/games", { data: { opponent: "Test" } });
    // CSRF check fires before session check: bare API POST has no Origin header -> 403
    expect(res.status()).toBe(403);
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

    const context = await browser.newContext({
      baseURL:      BASE_URL,
      // Seed a valid server-side session so we can reach the passkeys page without
      // a real password login. The session is HMAC-signed with SESSION_SECRET so
      // requireAuth accepts it. storageState bypasses CDP's __Host- cookie validation.
      storageState: makeAdminStorageState(ADMIN_USERNAME),
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
    const csrfToken = randomBytes(32).toString("hex");
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
