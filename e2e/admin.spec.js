/**
 * e2e/admin.spec.js
 * E2E tests for the admin panel.
 *
 * ADMIN_SLUG is loaded from .env / .env.local by playwright.config.js.
 * Set E2E_ADMIN_PASSWORD in .env.local to the plaintext password to enable
 * the login flow tests.
 *
 * Key implementation notes:
 * - Do NOT use waitForLoadState("networkidle") - Next.js dev mode keeps a
 *   WebSocket open for HMR which prevents networkidle from ever firing.
 * - The passkey button text is "SIGN IN WITH PASSKEY".
 * - The password fallback form button text is "SIGN IN".
 * - AdminLayout has no logout button - the logout test uses the DELETE /api/auth
 *   endpoint directly and verifies the login form reappears.
 * - The password fallback form is only shown when the URL contains
 *   ?fallback=<PASSKEY_FALLBACK_TOKEN>. Authenticated dashboard tests use
 *   that URL to reach the password form.
 */
import { test, expect } from "@playwright/test";

const ADMIN_SLUG            = process.env.ADMIN_SLUG             ?? null;
const ADMIN_PASSWORD        = process.env.E2E_ADMIN_PASSWORD     ?? null;
const ADMIN_USERNAME        = process.env.E2E_ADMIN_USERNAME     ?? "admin";
const PASSKEY_FALLBACK_TOKEN = process.env.PASSKEY_FALLBACK_TOKEN ?? null;

/** Navigate to the admin login page via the password fallback path and sign in. */
async function loginViaFallback(page, slug, token, username, password) {
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

// ── Full login flow (requires E2E_ADMIN_PASSWORD + PASSKEY_FALLBACK_TOKEN) ─

test.describe("Admin panel › Authenticated dashboard", () => {
  test("logs in and shows the admin nav bar", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !ADMIN_PASSWORD || !PASSKEY_FALLBACK_TOKEN,
      "ADMIN_SLUG, E2E_ADMIN_PASSWORD or PASSKEY_FALLBACK_TOKEN not configured");

    await loginViaFallback(page, ADMIN_SLUG, PASSKEY_FALLBACK_TOKEN, ADMIN_USERNAME, ADMIN_PASSWORD);

    // After successful login, the admin nav bar renders with "AK Admin" branding
    await expect(page.getByText("AK Admin")).toBeVisible({ timeout: 10_000 });
    // Login form should be gone
    await expect(page.getByText("Admin Access")).not.toBeVisible();
  });

  test("can navigate to the Games admin section after login", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !ADMIN_PASSWORD || !PASSKEY_FALLBACK_TOKEN,
      "ADMIN_SLUG, E2E_ADMIN_PASSWORD or PASSKEY_FALLBACK_TOKEN not configured");

    await loginViaFallback(page, ADMIN_SLUG, PASSKEY_FALLBACK_TOKEN, ADMIN_USERNAME, ADMIN_PASSWORD);
    await expect(page.getByText("AK Admin")).toBeVisible({ timeout: 10_000 });

    // Navigate to the Games admin section via URL
    await page.goto(`/admin/${ADMIN_SLUG}/games`);
    await page.waitForLoadState("load");

    // The login form should NOT reappear - session cookie is still valid
    await expect(page.getByText("Admin Access")).not.toBeVisible({ timeout: 5_000 });
    // The nav bar should still be visible
    await expect(page.getByText("AK Admin")).toBeVisible();
  });

  test("logout via DELETE /api/auth makes the login form reappear", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !ADMIN_PASSWORD || !PASSKEY_FALLBACK_TOKEN,
      "ADMIN_SLUG, E2E_ADMIN_PASSWORD or PASSKEY_FALLBACK_TOKEN not configured");

    await loginViaFallback(page, ADMIN_SLUG, PASSKEY_FALLBACK_TOKEN, ADMIN_USERNAME, ADMIN_PASSWORD);
    await expect(page.getByText("AK Admin")).toBeVisible({ timeout: 10_000 });

    // Call the logout endpoint directly (AdminLayout has no logout button)
    await page.evaluate(() => fetch("/api/auth", { method: "DELETE" }));

    // Reload - session is gone, passkey login form should reappear
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
  // Virtual WebAuthn authenticator via Chrome DevTools Protocol
  test("admin can register and authenticate with a passkey", async ({ browser }) => {
    test.skip(!ADMIN_SLUG || !ADMIN_PASSWORD || !PASSKEY_FALLBACK_TOKEN,
      "ADMIN_SLUG, E2E_ADMIN_PASSWORD or PASSKEY_FALLBACK_TOKEN not configured");

    const context = await browser.newContext();
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

    // Step 1: Sign in with password (fallback) to access the setup page
    await page.goto(`${process.env.PLAYWRIGHT_BASE_URL}/admin/${ADMIN_SLUG}?fallback=${PASSKEY_FALLBACK_TOKEN}`);
    await page.fill('input[autocomplete="username"]',         ADMIN_USERNAME);
    await page.fill('input[autocomplete="current-password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`**/admin/${ADMIN_SLUG}`);

    // Step 2: Navigate to passkeys page and register
    await page.goto(`${process.env.PLAYWRIGHT_BASE_URL}/admin/${ADMIN_SLUG}/passkeys`);
    await page.fill('input[placeholder*="Label"]', "E2E Test Key");
    await page.click('button:has-text("ADD PASSKEY")');
    await page.waitForSelector('text=E2E Test Key');

    // Step 3: Sign out
    await page.click('button:has-text("Sign out")');

    // Step 4: Sign in with passkey
    await page.goto(`${process.env.PLAYWRIGHT_BASE_URL}/admin/${ADMIN_SLUG}`);
    await page.click('button:has-text("SIGN IN WITH PASSKEY")');

    // Virtual authenticator handles the ceremony automatically
    await page.waitForURL(`**/admin/${ADMIN_SLUG}`, { timeout: 10_000 });
    await expect(page.locator("text=AK Admin")).toBeVisible();

    // Cleanup
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await context.close();
  });
});
