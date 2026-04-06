// playwright.config.js
// Load .env.local then .env so ADMIN_SLUG, SESSION_SECRET etc. are available
// to the Playwright test process (Next.js loads these automatically, but the
// test runner is a separate process and needs them explicitly).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir:         "./e2e",
  globalSetup:     "./e2e/global-setup.js",
  fullyParallel:   true,
  forbidOnly:      !!process.env.CI,
  retries:         process.env.CI ? 2 : 0,
  workers:         process.env.CI ? 1 : undefined,
  reporter:        "list",

  use: {
    baseURL: "http://localhost:3000",
    trace:   "on-first-retry",
    // Neon DB cold-starts can take ~10 s; give pages 30 s to fully render.
    // actionTimeout is left at the Playwright default (30 s) -- no override.
    navigationTimeout: 30_000,
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Auto-start the dev server if it's not already running.
  // Set reuseExistingServer:true locally so you can run `npm run dev` yourself.
  // SESSION_SECRET is required by requireAuth; fall back to a local test value
  // so admin routes work without a full Vercel env setup.
  webServer: {
    command:             "npm run dev",
    port:                3000,
    reuseExistingServer: !process.env.CI,
    timeout:             60_000,
    env: {
      SESSION_SECRET: process.env.SESSION_SECRET ?? "e2e-local-test-secret",
    },
  },
});
