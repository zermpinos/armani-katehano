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
      "lib/generated/**",
    ],
  },
  {
    // Custom rules -- applied to all non-ignored JS/JSX files
    rules: {
      "no-undef": "error", // catches prodError, requireAuth, etc. used without import
      // Escalate from warn -> error so the lint job fails on new injection sinks
      // rather than silently passing with annotations.
      "security/detect-object-injection": "error",
      // Force the node: protocol on all Node built-ins. Node 18+ resolves these
      // synchronously to the built-in module, never to a same-named npm package
      // -- closes a real supply-chain attack vector (typosquat / dependency
      // confusion against well-known module names).
      "no-restricted-imports": ["error", {
        paths: [
          { name: "buffer",         message: "Use node:buffer" },
          { name: "child_process",  message: "Use node:child_process" },
          { name: "crypto",         message: "Use node:crypto" },
          { name: "dns",            message: "Use node:dns" },
          { name: "fs",             message: "Use node:fs" },
          { name: "fs/promises",    message: "Use node:fs/promises" },
          { name: "http",           message: "Use node:http" },
          { name: "https",          message: "Use node:https" },
          { name: "net",            message: "Use node:net" },
          { name: "os",             message: "Use node:os" },
          { name: "path",           message: "Use node:path" },
          { name: "querystring",    message: "Use node:querystring" },
          { name: "stream",         message: "Use node:stream" },
          { name: "tls",            message: "Use node:tls" },
          { name: "url",            message: "Use node:url" },
          { name: "util",           message: "Use node:util" },
          { name: "zlib",           message: "Use node:zlib" },
        ],
      }],
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
            // Edge runtime boundary: middleware.ts and anything under
            // ./middleware/** runs on Vercel's Edge runtime, which has no
            // Node built-ins. Anything that touches Node primitives (dns,
            // crypto, fs, prisma, sentry server) MUST stay in src/server/**
            // and out of the Edge bundle. Edge code may only import from
            // src/server/security/edge/** (CSP nonce, header builders) and
            // from pure domain code.
            {
              target: ["./middleware.ts", "./middleware/**"],
              from: [
                "./src/server/security/node/**",
                "./src/server/db/**",
                "./src/server/auth/**",
                "./src/server/services/**",
                "./src/server/integrations/**",
              ],
              message:
                "middleware runs on the Edge runtime -- import only from src/server/security/edge or pure domain code.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;