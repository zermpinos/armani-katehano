#!/usr/bin/env node
// Text-replaces the Sentry SDK's `__SENTRY_TRACING__` magic identifier with
// the literal `false` so any bundler (webpack, Turbopack, etc.) sees a
// dead `if (false) { ... browserTracingIntegration() ... }` branch and
// drops the tracing code path along with its transitive deps.
//
// Why this script exists:
//   The Sentry Next.js client `init()` statically imports
//   `browserTracingIntegration` (node_modules/@sentry/nextjs/build/esm/
//   client/index.js, line ~10) and pushes it into the default integrations
//   list inside an `if (typeof __SENTRY_TRACING__ === 'undefined' ||
//   __SENTRY_TRACING__) { ... }` guard. Setting `defaultIntegrations:
//   false` at the call site prevents the runtime push but keeps the static
//   import — and therefore the bundle weight (~20 KiB after gzip).
//
//   The Sentry SDK ships `__SENTRY_TRACING__` precisely so bundlers can
//   text-replace it with `false` to dead-code that conditional. The
//   official @sentry/nextjs plugin injects the define on the webpack path
//   only (see node_modules/@sentry/nextjs/build/esm/config/webpack.js
//   `userSentryOptions.webpack?.treeshake?.removeTracing`). Next 16's
//   default bundler is Turbopack, which ignores that injection. Doing the
//   replacement in-place against the SDK source is bundler-agnostic — same
//   pattern as scripts/strip-next-polyfills.mjs.
//
// Idempotent: each run rewrites the touched files from scratch. `npm
// install` restores the originals, so the script must run before every
// build (wired into package.json `build`).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const TARGETS = [
  "node_modules/@sentry/nextjs/build/esm/client/index.js",
  "node_modules/@sentry/nextjs/build/cjs/client/index.js",
  "node_modules/@sentry/core/build/esm/utils/hasSpansEnabled.js",
  "node_modules/@sentry/core/build/cjs/utils/hasSpansEnabled.js",
];

const SENTINEL = "/* __SENTRY_TRACING__ stripped by scripts/strip-sentry-tracing.mjs */";

let touched = 0;
let skipped = 0;

for (const rel of TARGETS) {
  const abs = resolve(process.cwd(), rel);
  if (!existsSync(abs)) { // eslint-disable-line security/detect-non-literal-fs-filename
    console.warn(`[strip-sentry-tracing] target missing, skipping: ${rel}`);
    continue;
  }

  const current = readFileSync(abs, "utf8"); // eslint-disable-line security/detect-non-literal-fs-filename
  if (current.startsWith(SENTINEL)) {
    skipped++;
    continue;
  }

  // Replace the bare `__SENTRY_TRACING__` identifier with the literal
  // `false`. The conditionals
  //   `typeof __SENTRY_TRACING__ === 'undefined' || __SENTRY_TRACING__`
  //   `typeof __SENTRY_TRACING__ === 'boolean' && !__SENTRY_TRACING__`
  // both fold to a constant `false` after replacement, and bundlers drop
  // the dead branches plus the now-unused static imports.
  const next =
    SENTINEL +
    "\n" +
    current.replace(/\b__SENTRY_TRACING__\b/g, "false");

  writeFileSync(abs, next); // eslint-disable-line security/detect-non-literal-fs-filename
  touched++;
}

console.log(
  `[strip-sentry-tracing] stripped ${touched} file(s), ${skipped} already stripped`
);
