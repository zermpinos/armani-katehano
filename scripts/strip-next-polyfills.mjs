#!/usr/bin/env node
// Overwrites Next.js's hardcoded client polyfill module with an empty stub
// so it disappears from the production client bundle.
//
// Why this script exists:
//   node_modules/next/dist/client/index.js does an unconditional
//   require("../build/polyfills/polyfill-module") that ships ~14 KiB of
//   conditional polyfills (Array.prototype.at/flat/flatMap, Object.fromEntries
//   /hasOwn, String.prototype.trim{Start,End}, Promise.prototype.finally,
//   URL.canParse, Symbol.prototype.description). Every method is natively
//   supported by the production browserslist target (Chrome >=96, Firefox
//   >=94, Safari >=15.4, Edge >=96), so on every page load the bytes are
//   parsed and the conditional bodies short-circuit immediately — pure dead
//   code under the declared support matrix. PageSpeed flags this under
//   "Legacy JavaScript".
//
//   next.config.mjs aliases the module for webpack, but Turbopack (Next 16's
//   default build bundler) doesn't honor resolveAlias for relative requires
//   originating inside node_modules. Overwriting the source file is the only
//   bundler-agnostic fix.
//
// Idempotent: each run rewrites the file from scratch. `npm install` restores
// the original, so the script must run before every build (wired into
// package.json `build`).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const TARGET = resolve(
  process.cwd(),
  "node_modules/next/dist/build/polyfills/polyfill-module.js"
);
const STUB =
  '// Stripped by scripts/strip-next-polyfills.mjs.\n' +
  '// See lib/empty-polyfill-module.js for context.\n' +
  'module.exports = {};\n';
const SENTINEL = "Stripped by scripts/strip-next-polyfills.mjs";

if (!existsSync(TARGET)) {
  console.warn(`[strip-next-polyfills] target missing, skipping: ${TARGET}`);
  process.exit(0);
}

const current = readFileSync(TARGET, "utf8");
if (current.includes(SENTINEL)) {
  console.log("[strip-next-polyfills] already stripped");
  process.exit(0);
}

writeFileSync(TARGET, STUB);
console.log(`[strip-next-polyfills] stripped ${TARGET}`);
