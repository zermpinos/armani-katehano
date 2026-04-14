// playwright.config.js
// Load .env.local then .env so ADMIN_SLUG, SESSION_SECRET etc. are available
// to the Playwright test process (Next.js loads these automatically, but the
// test runner is a separate process and needs them explicitly).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { defineConfig, devices } from "@playwright/test";

// When PLAYWRIGHT_BASE_URL is set (e.g. in CI against a Vercel preview),
// target that URL directly and skip spinning up a local dev server.
const BASE_URL  = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const isRemote  = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir:         "./e2e",
  globalSetup:     "./e2e/global-setup.js",
  fullyParallel:   true,
  forbidOnly:      !!process.env.CI,
  retries:         process.env.CI ? 2 : 0,
  workers:         process.env.CI ? 1 : undefined,
  reporter:        process.env.CI
                     ? [["list"], ["html", { open: "never" }]]
                     : "list",

  use: {
    baseURL: BASE_URL,
    trace:   "on-first-retry",
    // Neon DB cold-starts can take ~10 s; give pages 30 s to fully render.
    // actionTimeout is left at the Playwright default (30 s) -- no override.
    navigationTimeout: 30_000,
    // Bypass Vercel Deployment Protection when running against a preview URL.
    // The secret is set in Vercel project settings -> "Protection Bypass for
    // Automation", then stored as the VERCEL_AUTOMATION_BYPASS_SECRET GitHub
    // Actions secret. Without this header every request gets "Login - Vercel".
    ...(isRemote && process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { extraHTTPHeaders: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET } }
      : {}),
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Auto-start the dev server only for local runs.
  // When targeting a remote URL the server is already up -- skip webServer.
  webServer: isRemote ? undefined : {
    command:             "npm run dev",
    port:                3000,
    reuseExistingServer: !process.env.CI,
    timeout:             60_000,
    env: {
      SESSION_SECRET: process.env.SESSION_SECRET ?? "e2e-local-test-secret",
    },
  },
});
