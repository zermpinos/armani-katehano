import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run files in tests/ — prevents Playwright spec files in e2e/ from
    // being picked up by vitest (they use test.describe which conflicts).
    include: ["tests/**/*.test.js"],
  },
});
