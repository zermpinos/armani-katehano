# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.js >> Admin panel › Authenticated dashboard >> logout via DELETE /api/auth makes the login form reappear
- Location: e2e/admin.spec.js:133:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_RESET at http://localhost:3000/admin/gpOy46fH3ZHOd6xz7r9p2g/
Call log:
  - navigating to "http://localhost:3000/admin/gpOy46fH3ZHOd6xz7r9p2g/", waiting until "load"

```

# Test source

```ts
  37  |     // Mock POST /api/auth to return 401 — avoids recording a real failed
  38  |     // attempt in the DB which would trigger brute-force lockout after
  39  |     // repeated test runs.
  40  |     await page.route("**/api/auth", async route => {
  41  |       if (route.request().method() === "POST") {
  42  |         return route.fulfill({
  43  |           status:      401,
  44  |           contentType: "application/json",
  45  |           body:        JSON.stringify({ error: "Invalid credentials" }),
  46  |         });
  47  |       }
  48  |       return route.fulfill({
  49  |         status:      401,
  50  |         contentType: "application/json",
  51  |         body:        JSON.stringify({ error: "Not authenticated" }),
  52  |       });
  53  |     });
  54  | 
  55  |     await page.goto(`/admin/${ADMIN_SLUG}/`);
  56  |     await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
  57  | 
  58  |     await page.locator("input[type='password']").fill("definitely-wrong-password");
  59  |     await page.getByRole("button", { name: "SIGN IN" }).click();
  60  | 
  61  |     // Wait for the error message from mocked /api/auth → 401
  62  |     await expect(page.getByText(/invalid|incorrect|credentials/i)).toBeVisible({ timeout: 8_000 });
  63  |   });
  64  | 
  65  |   test("shows lockout message after too many wrong attempts (mocked 429)", async ({ page }) => {
  66  |     test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
  67  | 
  68  |     // Mock POST /api/auth to return 429 — tests the UI renders the lockout message correctly.
  69  |     // The actual lockout enforcement is covered in api.auth.test.js.
  70  |     await page.route("**/api/auth", async route => {
  71  |       if (route.request().method() === "POST") {
  72  |         return route.fulfill({
  73  |           status:      429,
  74  |           contentType: "application/json",
  75  |           body:        JSON.stringify({ error: "Too many failed attempts. Try again later.", retryAfter: 900 }),
  76  |         });
  77  |       }
  78  |       // GET → 401 (not authenticated)
  79  |       return route.fulfill({
  80  |         status:      401,
  81  |         contentType: "application/json",
  82  |         body:        JSON.stringify({ error: "Not authenticated" }),
  83  |       });
  84  |     });
  85  | 
  86  |     await page.goto(`/admin/${ADMIN_SLUG}/`);
  87  |     await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
  88  | 
  89  |     await page.locator("input[type='password']").fill("any");
  90  |     await page.getByRole("button", { name: "SIGN IN" }).click();
  91  | 
  92  |     await expect(page.getByText(/too many|try again/i)).toBeVisible({ timeout: 5_000 });
  93  |   });
  94  | });
  95  | 
  96  | // ── Full login flow (requires E2E_ADMIN_PASSWORD) ──────────────────────────
  97  | 
  98  | test.describe("Admin panel › Authenticated dashboard", () => {
  99  |   test("logs in and shows the admin nav bar", async ({ page }) => {
  100 |     test.skip(!ADMIN_SLUG || !ADMIN_PASSWORD, "ADMIN_SLUG or E2E_ADMIN_PASSWORD not configured");
  101 | 
  102 |     await page.goto(`/admin/${ADMIN_SLUG}/`);
  103 |     await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
  104 | 
  105 |     await page.locator("input[type='password']").fill(ADMIN_PASSWORD);
  106 |     await page.getByRole("button", { name: "SIGN IN" }).click();
  107 | 
  108 |     // After successful login, the admin nav bar renders with "AK Admin" branding
  109 |     await expect(page.getByText("AK Admin")).toBeVisible({ timeout: 10_000 });
  110 |     // Login form should be gone
  111 |     await expect(page.getByText("Admin Access")).not.toBeVisible();
  112 |   });
  113 | 
  114 |   test("can navigate to the Games admin section after login", async ({ page }) => {
  115 |     test.skip(!ADMIN_SLUG || !ADMIN_PASSWORD, "ADMIN_SLUG or E2E_ADMIN_PASSWORD not configured");
  116 | 
  117 |     await page.goto(`/admin/${ADMIN_SLUG}/`);
  118 |     await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
  119 |     await page.locator("input[type='password']").fill(ADMIN_PASSWORD);
  120 |     await page.getByRole("button", { name: "SIGN IN" }).click();
  121 |     await expect(page.getByText("AK Admin")).toBeVisible({ timeout: 10_000 });
  122 | 
  123 |     // Navigate to the Games admin section via URL
  124 |     await page.goto(`/admin/${ADMIN_SLUG}/games`);
  125 |     await page.waitForLoadState("load");
  126 | 
  127 |     // The login form should NOT reappear — session cookie is still valid
  128 |     await expect(page.getByText("Admin Access")).not.toBeVisible({ timeout: 5_000 });
  129 |     // The nav bar should still be visible
  130 |     await expect(page.getByText("AK Admin")).toBeVisible();
  131 |   });
  132 | 
  133 |   test("logout via DELETE /api/auth makes the login form reappear", async ({ page }) => {
  134 |     test.skip(!ADMIN_SLUG || !ADMIN_PASSWORD, "ADMIN_SLUG or E2E_ADMIN_PASSWORD not configured");
  135 | 
  136 |     // Login first
> 137 |     await page.goto(`/admin/${ADMIN_SLUG}/`);
      |                ^ Error: page.goto: net::ERR_CONNECTION_RESET at http://localhost:3000/admin/gpOy46fH3ZHOd6xz7r9p2g/
  138 |     await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
  139 |     await page.locator("input[type='password']").fill(ADMIN_PASSWORD);
  140 |     await page.getByRole("button", { name: "SIGN IN" }).click();
  141 |     await expect(page.getByText("AK Admin")).toBeVisible({ timeout: 10_000 });
  142 | 
  143 |     // Call the logout endpoint directly (AdminLayout has no logout button)
  144 |     await page.evaluate(() => fetch("/api/auth", { method: "DELETE" }));
  145 | 
  146 |     // Reload — session is gone, login form should reappear
  147 |     await page.reload();
  148 |     await expect(page.getByText("Admin Access")).toBeVisible({ timeout: 10_000 });
  149 |   });
  150 | });
  151 | 
  152 | // ── API-level auth guard (always runs — no credentials needed) ─────────────
  153 | 
  154 | test.describe("Admin panel › API protection", () => {
  155 |   test("GET /api/admin/games returns 401 without a session cookie", async ({ request }) => {
  156 |     const res = await request.get("/api/admin/games");
  157 |     expect(res.status()).toBe(401);
  158 |   });
  159 | 
  160 |   test("POST /api/admin/games returns 401 without a session cookie", async ({ request }) => {
  161 |     const res = await request.post("/api/admin/games", { data: { opponent: "Test" } });
  162 |     expect(res.status()).toBe(401);
  163 |   });
  164 | });
  165 | 
```