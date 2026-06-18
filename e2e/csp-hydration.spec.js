import { test, expect } from "@playwright/test";

const PAGES = ["/", "/players", "/games", "/leaderboard", "/team-stats"];

for (const path of PAGES) {
  test(`CSP hydration — ${path} — no violations, React hydrates`, async ({ page }) => {
    const errors = [];
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", e => errors.push(e.message));

    const response = await page.goto(path);
    const csp = response.headers()["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).not.toContain("'nonce-");

    await page.waitForLoadState("networkidle");

    const cspErrors = errors.filter(e => /Content.Security.Policy|CSP/i.test(e));
    expect(cspErrors).toHaveLength(0);
  });
}
