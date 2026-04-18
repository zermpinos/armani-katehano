import { test, expect } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/games", "/leaderboard", "/players"];

for (const path of PUBLIC_PAGES) {
  test.describe(`CSP nonce — ${path}`, () => {
    test("response carries a Content-Security-Policy header with a nonce", async ({ page }) => {
      const response = await page.goto(path);
      const csp = response.headers()["content-security-policy"];
      expect(csp).toBeTruthy();
      expect(csp).toMatch(/'nonce-[A-Za-z0-9+/]+=*'/);
    });

    test("every <script> tag has a matching nonce attribute", async ({ page }) => {
      const response = await page.goto(path);
      const csp      = response.headers()["content-security-policy"];

      const match = csp?.match(/'nonce-([A-Za-z0-9+/=]+)'/);
      expect(match).toBeTruthy();
      const nonce = match[1];

      const scripts = page.locator("script");
      const count   = await scripts.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const scriptNonce = await scripts.nth(i).getAttribute("nonce");
        expect(
          scriptNonce,
          `script[${i}] on ${path} is missing nonce or has wrong value`,
        ).toBe(nonce);
      }
    });
  });
}
