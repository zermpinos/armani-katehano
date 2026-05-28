/**
 * e2e/admin.spec.js
 * E2E tests for the admin panel.
 *
 * ADMIN_SLUG is loaded from .env / .env.local by playwright.config.js.
 * Set E2E_ADMIN_PASSWORD in .env.local to the plaintext password to enable
 * the login flow tests.
 *
 * Key implementation notes:
 * - Do NOT use waitForLoadState("networkidle") -- Next.js dev mode keeps a
 *   WebSocket open for HMR which prevents networkidle from ever firing.
 * - The submit button text is "SIGN IN".
 * - AdminLayout has no logout button -- the logout test uses the DELETE /api/auth
 *   endpoint directly and verifies the login form reappears.
 */
import { test, expect } from "@playwright/test";

const ADMIN_SLUG     = process.env.ADMIN_SLUG          ?? null;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD  ?? null;
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME  ?? "admin";

// ── Login form structure ───────────────────────────────────────────────────

test.describe("Admin panel › Login form", () => {
  test("shows the login form when not authenticated", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");

    await page.goto(`/admin/${ADMIN_SLUG}/`);
    // Wait for React to hydrate and the GET /api/auth call to return 401
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.getByRole("button", { name: "SIGN IN" })).toBeVisible();
  });

  test("shows an error on wrong password", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");

    // Mock POST /api/auth to return 401 -- avoids recording a real failed
    // attempt in the DB which would trigger brute-force lockout after
    // repeated test runs.
    await page.route("**/api/auth", async route => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status:      401,
          contentType: "application/json",
          body:        JSON.stringify({ error: "Invalid credentials" }),
        });
      }
      return route.fulfill({
        status:      401,
        contentType: "application/json",
        body:        JSON.stringify({ error: "Not authenticated" }),
      });
    });

    await page.goto(`/admin/${ADMIN_SLUG}/`);
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder("Enter username").fill("admin");
    await page.locator("input[type='password']").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "SIGN IN" }).click();

    // Wait for the error message from mocked /api/auth -> 401
    await expect(page.getByText(/invalid|incorrect|credentials/i)).toBeVisible({ timeout: 8_000 });
  });

  test("shows lockout message after too many wrong attempts (mocked 429)", async ({ page }) => {
    test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");

    // Mock POST /api/auth to return 429 -- tests the UI renders the lockout message correctly.
    // The actual lockout enforcement is covered in api.auth.test.js.
    await page.route("**/api/auth", async route => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status:      429,
          contentType: "application/json",
          body:        JSON.stringify({ error: "Too many failed attempts. Try again later.", retryAfter: 900 }),
        });
      }
      // GET -> 401 (not authenticated)
      return route.fulfill({
        status:      401,
        contentType: "application/json",
        body:        JSON.stringify({ error: "Not authenticated" }),
      });
    });

    await page.goto(`/admin/${ADMIN_SLUG}/`);
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder("Enter username").fill("admin");
    await page.locator("input[type='password']").fill("any");
    await page.getByRole("button", { name: "SIGN IN" }).click();

    await expect(page.getByText(/too many|try again/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ── Full login flow (requires E2E_ADMIN_PASSWORD) ──────────────────────────

test.describe("Admin panel › Authenticated dashboard", () => {
  test("logs in and shows the admin nav bar", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !ADMIN_PASSWORD, "ADMIN_SLUG or E2E_ADMIN_PASSWORD not configured");

    await page.goto(`/admin/${ADMIN_SLUG}/`);
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder("Enter username").fill(ADMIN_USERNAME);
    await page.locator("input[type='password']").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "SIGN IN" }).click();

    // After successful login, the admin nav bar renders with "AK Admin" branding
    await expect(page.getByText("AK Admin")).toBeVisible({ timeout: 10_000 });
    // Login form should be gone
    await expect(page.getByText("Admin Access")).not.toBeVisible();
  });

  test("can navigate to the Games admin section after login", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !ADMIN_PASSWORD, "ADMIN_SLUG or E2E_ADMIN_PASSWORD not configured");

    await page.goto(`/admin/${ADMIN_SLUG}/`);
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder("Enter username").fill(ADMIN_USERNAME);
    await page.locator("input[type='password']").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "SIGN IN" }).click();
    await expect(page.getByText("AK Admin")).toBeVisible({ timeout: 10_000 });

    // Navigate to the Games admin section via URL
    await page.goto(`/admin/${ADMIN_SLUG}/games`);
    await page.waitForLoadState("load");

    // The login form should NOT reappear -- session cookie is still valid
    await expect(page.getByText("Admin Access")).not.toBeVisible({ timeout: 5_000 });
    // The nav bar should still be visible
    await expect(page.getByText("AK Admin")).toBeVisible();
  });

  test("logout via DELETE /api/auth makes the login form reappear", async ({ page }) => {
    test.skip(!ADMIN_SLUG || !ADMIN_PASSWORD, "ADMIN_SLUG or E2E_ADMIN_PASSWORD not configured");

    // Login first
    await page.goto(`/admin/${ADMIN_SLUG}/`);
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder("Enter username").fill(ADMIN_USERNAME);
    await page.locator("input[type='password']").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "SIGN IN" }).click();
    await expect(page.getByText("AK Admin")).toBeVisible({ timeout: 10_000 });

    // Call the logout endpoint directly (AdminLayout has no logout button)
    await page.evaluate(() => fetch("/api/auth", { method: "DELETE" }));

    // Reload -- session is gone, login form should reappear
    await page.reload();
    await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
  });
});

// ── API-level auth guard (always runs -- no credentials needed) ─────────────

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
    test.skip(!ADMIN_SLUG || !ADMIN_PASSWORD, "ADMIN_SLUG or E2E_ADMIN_PASSWORD not configured");

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
    const fallbackToken = process.env.PASSKEY_FALLBACK_TOKEN ?? "";
    await page.goto(`${process.env.PLAYWRIGHT_BASE_URL}/admin/${ADMIN_SLUG}?fallback=${fallbackToken}`);
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
