import { test, expect } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/games", "/leaderboard", "/players"];
const ADMIN_SLUG   = process.env.ADMIN_SLUG ?? null;

for (const path of PUBLIC_PAGES) {
  test.describe(`CSP hash: ${path}`, () => {
    test("response carries a Content-Security-Policy header with sha256 hashes or self", async ({ page }) => {
      const response = await page.goto(path);
      const csp = response.headers()["content-security-policy"];
      expect(csp).toBeTruthy();
      expect(csp).not.toMatch(/'nonce-[A-Za-z0-9+/]+=*'/);
      const scriptSrc = csp.split(";").find(d => d.trim().startsWith("script-src"));
      expect(scriptSrc).toContain("'self'");
      expect(csp).not.toContain("challenges.cloudflare.com");
    });
  });
}

// After three failed logins the form loads the Turnstile widget from Cloudflare.
test("the admin login page allows the Turnstile widget", async ({ page }) => {
  test.skip(!ADMIN_SLUG, "ADMIN_SLUG not configured");
  const response = await page.goto(`/admin/${ADMIN_SLUG}/`);
  const csp = response.headers()["content-security-policy"].split(";");
  expect(csp.find(d => d.trim().startsWith("script-src"))).toContain("https://challenges.cloudflare.com");
  expect(csp.find(d => d.trim().startsWith("frame-src"))).toContain("https://challenges.cloudflare.com");
});
