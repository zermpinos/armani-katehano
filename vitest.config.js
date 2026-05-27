import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      // Mirrors tsconfig paths: @/ resolves to src/ first, then project root as fallback.
      // Vitest doesn't read tsconfig paths natively, so we declare them here.
      // The regex must match more specific patterns first (pages/, etc.) before generic @/
      { find: /^@\/pages\/(.*)$/, replacement: path.resolve(__dirname, "pages/$1") },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "src/$1") },
    ],
  },
  test: {
    // Only run files in tests/ -- prevents Playwright spec files in e2e/ from
    // being picked up by vitest (they use test.describe which conflicts).
    include: ["tests/**/*.test.ts"],
  },
});
