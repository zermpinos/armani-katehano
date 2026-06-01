import { test, expect } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/games", "/leaderboard", "/players"];

for (const path of PUBLIC_PAGES) {
  test.describe(`CSP nonce - ${path}`, () => {
    test("response carries a Content-Security-Policy header with a nonce", async ({ page }) => {
      const response = await page.goto(path);
      const csp = response.headers()["content-security-policy"];
      expect(csp).toBeTruthy();
      expect(csp).toMatch(/'nonce-[A-Za-z0-9+/]+=*'/);
    });

  });
}
