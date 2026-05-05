#!/usr/bin/env node
// Replaces the single `url.parse()` call in Tailwind CSS v3's
// setupContextUtils.js with an equivalent that uses the WHATWG URL API
// (new URL()) so Node 24's DEP0169 deprecation warning is not raised during
// `next build`.
//
// Why this script exists:
//   tailwindcss/src/lib/setupContextUtils.js line 662 calls url.parse(file)
//   to extract pathname, hash, and search from a file path. Node 24 raises
//   DEP0169 for every url.parse() call. Tailwind v3 receives only security
//   fixes; this functional change will not land upstream. The WHATWG URL
//   constructor throws on bare POSIX paths, so we wrap it in a try/catch
//   and fall back to treating the input as a plain path with no fragments.
//
// Idempotent: each run is a no-op after the first. `npm install` restores the
// original, so the script must run before every build (wired into package.json
// `build`).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const TARGET = resolve(
  process.cwd(),
  "node_modules/tailwindcss/src/lib/setupContextUtils.js"
);

const SENTINEL = "// Patched by scripts/patch-tailwind-url.mjs";

const OLD_IMPORT = "import url from 'url'";

const OLD_PARSE =
  "    let parsed = url.parse(file)\n" +
  "    let pathname = parsed.hash ? parsed.href.replace(parsed.hash, '') : parsed.href\n" +
  "    pathname = parsed.search ? pathname.replace(parsed.search, '') : pathname";

const NEW_PARSE =
  SENTINEL + "\n" +
  "    let parsed\n" +
  "    try { parsed = new URL(file) } catch { parsed = { hash: '', search: '', href: file } }\n" +
  "    let pathname = parsed.hash ? parsed.href.replace(parsed.hash, '') : parsed.href\n" +
  "    pathname = parsed.search ? pathname.replace(parsed.search, '') : pathname";

if (!existsSync(TARGET)) {
  console.warn(`[patch-tailwind-url] target missing, skipping: ${TARGET}`);
  process.exit(0);
}

const current = readFileSync(TARGET, "utf8");

if (current.includes(SENTINEL)) {
  console.log("[patch-tailwind-url] already patched");
  process.exit(0);
}

if (!current.includes(OLD_PARSE)) {
  console.warn("[patch-tailwind-url] expected url.parse block not found -- tailwindcss may have changed; skipping");
  process.exit(0);
}

const patched = current
  .replace(OLD_IMPORT, "// url import removed by scripts/patch-tailwind-url.mjs")
  .replace(OLD_PARSE, NEW_PARSE);

writeFileSync(TARGET, patched);
console.log("[patch-tailwind-url] patched url.parse -> new URL() in", TARGET);
