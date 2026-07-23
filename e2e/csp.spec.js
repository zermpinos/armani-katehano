import { test, expect } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/games", "/leaderboard", "/players"];

for (const path of PUBLIC_PAGES) {
  test.describe(`CSP hash: ${path}`, () => {
    test("response carries a Content-Security-Policy header with sha256 hashes or self", async ({ page }) => {
      const response = await page.goto(path);
      const csp = response.headers()["content-security-policy"];
      expect(csp).toBeTruthy();
      expect(csp).not.toMatch(/'nonce-[A-Za-z0-9+/]+=*'/);
      const scriptSrc = csp.split(";").find(d => d.trim().startsWith("script-src"));
      expect(scriptSrc).toContain("'self'");
    });
  });
}
