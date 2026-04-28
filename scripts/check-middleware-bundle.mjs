#!/usr/bin/env node
/**
 * Audit-grade backstop: after `next build`, scan the produced middleware
 * bundle(s) for any reference to a Node built-in that has no Edge-runtime
 * implementation. ESLint zones and `server-only` markers should already
 * keep these out, but if Next.js, Webpack, or a refactor ever bypasses
 * those, this script fails the build with a clear diff.
 *
 * Run after `next build` — wired in via .github/workflows/ci.yml.
 */
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-non-literal-regexp --
 * fs reads only walk .next/server/ build output (no user input);
 * RegExp inputs come from the hardcoded FORBIDDEN_MODULES list below. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Modules that the Edge runtime does NOT implement. Edge does provide
// limited shims for buffer / crypto / stream / util — those are NOT in
// this list. If you see one of these in middleware, the worker will
// throw on first request.
const FORBIDDEN_MODULES = [
  "dns",
  "net",
  "tls",
  "child_process",
  "cluster",
  "fs",
  "fs/promises",
  "os",
  "http",
  "https",
  "http2",
  "zlib",
  "v8",
  "vm",
  "worker_threads",
  "inspector",
  "perf_hooks",
  "dgram",
];

const BUILD_DIR = ".next/server";

function walk(dir) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (s.isFile()) out.push(p);
  }
  return out;
}

function isMiddlewareBundle(path) {
  const lower = path.toLowerCase();
  if (!lower.endsWith(".js")) return false;
  // .next/server/edge/**       — Turbopack/Webpack edge-runtime chunks
  // .next/server/middleware/** — middleware-specific output
  // .next/server/edge-functions/**, edge-runtime/** — older Next layouts
  // *middleware*.js anywhere   — entry bundles (e.g. .next/server/middleware.js)
  return /[\\/]edge[\\/]/.test(lower)
      || /[\\/]middleware[\\/]/.test(lower)
      || /[\\/]edge-functions[\\/]/.test(lower)
      || /[\\/]edge-runtime[\\/]/.test(lower)
      || /[\\/]middleware[^\\/]*\.js$/.test(lower);
}

const bundles = walk(BUILD_DIR).filter(isMiddlewareBundle);

if (bundles.length === 0) {
  console.error(`✗ no middleware bundle found under ${BUILD_DIR}/ — did \`next build\` run?`);
  process.exit(1);
}

const violations = [];
for (const file of bundles) {
  const content = readFileSync(file, "utf8");
  for (const mod of FORBIDDEN_MODULES) {
    const escaped = mod.replace(/\//g, "\\/");
    const patterns = [
      new RegExp(`require\\(["']${escaped}["']\\)`, "g"),
      new RegExp(`require\\(["']node:${escaped}["']\\)`, "g"),
      new RegExp(`from\\s+["']${escaped}["']`, "g"),
      new RegExp(`from\\s+["']node:${escaped}["']`, "g"),
    ];
    for (const re of patterns) {
      const matches = content.match(re);
      if (matches) violations.push({ file, module: mod, count: matches.length });
    }
  }
}

if (violations.length === 0) {
  console.log(`✓ middleware bundle clean — scanned ${bundles.length} file(s), no forbidden Node built-ins`);
  process.exit(0);
}

console.error("✗ middleware bundle pulls in forbidden Node built-ins:");
for (const v of violations) {
  console.error(`    ${v.file} — "${v.module}" (${v.count} occurrence${v.count > 1 ? "s" : ""})`);
}
console.error("");
console.error("  This means a Node-only module reached the Edge bundle.");
console.error("  Check imports in middleware.ts and any of its transitive dependencies.");
console.error("  See docs/architecture.md §2 for the runtime-split rules.");
process.exit(1);
