// eslint.config.mjs
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import security from "eslint-plugin-security";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import importPlugin from "eslint-plugin-import";

const eslintConfig = [
  ...nextCoreWebVitals,
  security.configs.recommended,
  noUnsanitized.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // Custom rules -- applied to all non-ignored JS/JSX files
    rules: {
      "no-undef": "error", // catches prodError, requireAuth, etc. used without import
    },
  },
  // ─── Architecture layer enforcement ───────────────────────────────────────
  // These zones encode the import rules from docs/architecture.md:
  //   components/ui  -> no server, no features
  //   src/client/**  -> no server
  //   features       -> no server
  //   domain         -> no server, no components, no features, no React/Next/Prisma
  {
    plugins: { import: importPlugin },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // UI primitives must stay pure -- no server-side or feature code
            {
              target: ["./components/**", "./src/components/**"],
              from: ["./src/server/**", "./src/features/**"],
              message:
                "components/ui must not import from server or feature layers.",
            },
            // Client components must not reach into server layer
            {
              target: ["./src/client/**"],
              from: ["./src/server/**"],
              message:
                "src/client/* must not import from src/server/*. Use an API route instead.",
            },
            // Feature components must not reach into server layer
            {
              target: ["./src/features/**"],
              from: ["./src/server/**"],
              message:
                "features/* must not import from server/*. Use a data-fetching hook or API route instead.",
            },
            // Pure domain logic -- no I/O, no React, no Next, no Prisma
            {
              target: ["./src/domain/**"],
              from: [
                "./src/server/**",
                "./src/components/**",
                "./src/features/**",
              ],
              message:
                "domain/* must be pure -- no server, component, or feature imports.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;