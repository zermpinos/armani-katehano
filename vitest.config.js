import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors tsconfig paths: @/ resolves to src/ first, project root as fallback.
      // Vitest doesn't read tsconfig paths natively, so we declare them here.
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // Only run files in tests/ -- prevents Playwright spec files in e2e/ from
    // being picked up by vitest (they use test.describe which conflicts).
    include: ["tests/**/*.test.ts"],
  },
});
