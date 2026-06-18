import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

test("CSP blocks injected inline script", async ({ page }) => {
  const rand = randomBytes(8).toString("hex");
  const marker = `__pwned_${rand}`;

  await page.route("**/", async route => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace("</body>", `<script>window["${marker}"] = true;</script></body>`);
    await route.fulfill({
      response,
      body,
      headers: { ...response.headers() },
    });
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const injected = await page.evaluate(key => key in window, marker);
  expect(injected).toBe(false);
});
