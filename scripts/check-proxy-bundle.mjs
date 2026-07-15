#!/usr/bin/env node
/**
 * Audit backstop: verify the built proxy still matches the runtime the
 * codebase is written against, and that it pulls in no module we keep out.
 *
 * Run after `next build` - wired in via .github/workflows/ci.yml.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BUILD_DIR       = ".next/server";
const ENTRY           = join(BUILD_DIR, "middleware.js");
const CONFIG_MANIFEST = join(BUILD_DIR, "functions-config-manifest.json");
const TRACE           = join(BUILD_DIR, "middleware.js.nft.json");
const PROXY_KEY       = "/_middleware";

// Next 16 renamed middleware to proxy and moved it to the node runtime;
// `runtime: "edge"` is rejected outright. Pin the value so a future upgrade
// moving it again fails here rather than silently changing what the proxy is
// allowed to import.
const EXPECTED_RUNTIME = "nodejs";

// The node runtime would happily run any of these. The point is that the
// proxy sits on every request: it must stay small and must not reach the
// database directly.
const FORBIDDEN = [
  "@prisma/client",
  "@prisma/adapter-neon",
  "@neondatabase/serverless",
  "@simplewebauthn/server",
  "bcryptjs",
  "nodemailer",
];

function fail(msg, ...rest) {
  console.error(`x ${msg}`);
  for (const line of rest) console.error(`    ${line}`);
  process.exit(1);
}

const read = p => readFileSync(p, "utf8");

// "../../node_modules/@prisma/client/default.js" -> "@prisma/client"
// Prisma 7 emits a hash-suffixed directory, so callers must prefix-match.
function packageOf(path) {
  const marker = "node_modules/";
  const i = path.lastIndexOf(marker);
  if (i === -1) return null;
  const parts = path.slice(i + marker.length).split("/").filter(Boolean);
  if (!parts.length) return null;
  return parts[0].startsWith("@") && parts.length > 1
    ? `${parts[0]}/${parts[1]}`
    : parts[0];
}

const isForbidden = name =>
  name != null &&
  FORBIDDEN.find(f => name === f || name.startsWith(`${f}-`) || name.startsWith(`${f}/`));

// ---- 1. the runtime the rest of the codebase is written against ----------
if (!existsSync(CONFIG_MANIFEST)) fail(`no ${CONFIG_MANIFEST}`, "did `next build` run?");

const config    = JSON.parse(read(CONFIG_MANIFEST));
const functions = new Map(Object.entries(config.functions ?? {}));
const entry     = functions.get(PROXY_KEY);

if (!entry) {
  fail(`no "${PROXY_KEY}" entry in ${CONFIG_MANIFEST}`,
       `found: ${[...functions.keys()].join(", ") || "(none)"}`,
       "the proxy did not build, or next changed the manifest shape");
}

if (entry.runtime !== EXPECTED_RUNTIME) {
  fail(`proxy runtime is "${entry.runtime}", expected "${EXPECTED_RUNTIME}"`,
       "the runtime moved under us. docs/architecture.md section 2 and the",
       "import zones in eslint.config.mjs are written against the old one.");
}

// ---- 2. resolve the real chunk graph ------------------------------------
// `.next/server/middleware.js` is a turbopack loader stub of a few hundred
// bytes naming the chunks that hold the code. Resolve those rather than
// pattern-matching file paths, which is how this check scanned nothing at all.
if (!existsSync(ENTRY)) fail(`no ${ENTRY}`, "did `next build` run?");

const stub   = read(ENTRY);
const chunks = [...stub.matchAll(/["'](server\/chunks\/[^"']+)["']/g)]
  .map(m => join(".next", m[1]))
  .filter((p, i, a) => a.indexOf(p) === i);

const absent = chunks.filter(p => !existsSync(p));
if (absent.length) fail("chunks named by the stub do not exist", ...absent);

const scanned = [ENTRY, ...chunks];
const bytes   = scanned.reduce((n, p) => n + readFileSync(p).length, 0);

// Scanning only the stub is what left this check vacuous for so long: it
// passed while reading none of the code. Refuse to report success on a graph
// that plainly did not resolve.
if (!chunks.length || bytes < 10_000) {
  fail(`resolved only ${bytes} bytes across ${scanned.length} file(s)`,
       "the chunk graph did not resolve, so this check proves nothing",
       ...scanned);
}

// ---- 3. what the proxy actually depends on ------------------------------
const found = new Map();
const note  = (name, where) => { if (!found.has(name)) found.set(name, where); };

// Bundled requires. Turbopack rewrites externals to
// require("<pkg>") inside e.x(...), and prisma's name carries a hash.
for (const file of scanned) {
  for (const m of read(file).matchAll(/require\(["']([^"']+)["']\)/g)) {
    if (isForbidden(m[1])) note(m[1], file);
  }
}

// The node file trace is the build's own dependency list for the proxy, and
// it survives minification and renaming, so it is the more durable signal.
if (existsSync(TRACE)) {
  for (const f of JSON.parse(read(TRACE)).files ?? []) {
    const pkg = packageOf(f);
    if (isForbidden(pkg)) note(pkg, TRACE);
  }
} else {
  fail(`no ${TRACE}`, "expected a node file trace for a nodejs-runtime proxy");
}

if (found.size) {
  console.error("x proxy pulls in forbidden modules:");
  for (const [name, where] of found) console.error(`    "${name}"  (via ${where})`);
  console.error("");
  console.error("  Check imports in proxy.ts and its transitive dependencies.");
  console.error("  See docs/architecture.md section 2.");
  process.exit(1);
}

console.log(`+ proxy runtime "${entry.runtime}" as expected`);
console.log(`+ proxy clean - ${scanned.length} chunk(s), ${(bytes / 1024).toFixed(0)} KB, no forbidden modules`);
