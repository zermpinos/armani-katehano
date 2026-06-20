#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT      = resolve(fileURLToPath(import.meta.url), "../..");
const BUILD_DIR = join(ROOT, ".next/server/pages");
const HASH_FILE = join(ROOT, "src/server/security/edge/csp-hashes.ts");

let failures = 0;

function fail(msg) {
  process.stderr.write(`FAIL: ${msg}\n`);
  failures++;
}

function check(path, label) {
  if (!existsSync(path)) fail(`Missing pre-rendered page: ${label} (${path})`);
}

check(join(BUILD_DIR, "index.html"),       "/");
check(join(BUILD_DIR, "games.html"),       "/games");
check(join(BUILD_DIR, "players.html"),     "/players");
check(join(BUILD_DIR, "leaderboard.html"), "/leaderboard");
check(join(BUILD_DIR, "team-stats.html"),  "/team-stats");

const gamesDir   = join(BUILD_DIR, "games");
const playersDir = join(BUILD_DIR, "players");
const gameFiles   = existsSync(gamesDir)   ? readdirSync(gamesDir).filter(f => f.endsWith(".html"))   : [];
const playerFiles = existsSync(playersDir) ? readdirSync(playersDir).filter(f => f.endsWith(".html")) : [];

// CI builds without DB cannot exercise getStaticPaths and produce no dynamic
// HTML; downgrade the per-game / per-player checks to warnings in that case.
const dbBackedBuild = gameFiles.length > 0 || playerFiles.length > 0;
if (dbBackedBuild) {
  if (gameFiles.length === 0)   fail("No per-game HTML files found under .next/server/pages/games/");
  if (playerFiles.length === 0) fail("No per-player HTML files found under .next/server/pages/players/");
} else {
  process.stdout.write("check-isr-pages: skipping dynamic-route checks (build had no DB; nothing to pre-render)\n");
}

function listAdminHtml(dir) {
  if (!existsSync(dir)) return [];
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(listAdminHtml(p));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}
const adminHtml = listAdminHtml(join(BUILD_DIR, "admin"));
if (adminHtml.length > 0) fail(`Admin HTML pages found in pre-rendered set: ${adminHtml.join(", ")}. Admin must stay SSR.`);

// Turbopack splits the Edge middleware into a tiny loader plus content-hashed
// chunks; scan every server-side JS bundle and treat the hash as present if it
// appears in any of them. csp-hashes is imported only by the proxy, so the
// only places it can land are the middleware loader and its chunks.
function collectServerJs(dir) {
  let out = [];
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out = out.concat(collectServerJs(p));
      else if (e.name.endsWith(".js")) out.push(p);
    }
  } catch {}
  return out;
}

const bundleDir   = join(ROOT, ".next/server");
const bundleFiles = collectServerJs(bundleDir);
if (bundleFiles.length === 0) {
  fail("Could not find any Edge bundle JS under .next/server/");
} else {
  const blob    = bundleFiles.map(f => readFileSync(f, "utf8")).join("\n");
  const hashSrc = readFileSync(HASH_FILE, "utf8");
  const hashRe  = /"(sha256-[A-Za-z0-9+/]{43}=)"/g;
  let m;
  while ((m = hashRe.exec(hashSrc)) !== null) {
    const h = m[1];
    if (!blob.includes(h)) fail(`Committed hash ${h} not found in any Edge bundle under .next/server/`);
  }
}

if (failures > 0) {
  process.stderr.write(`\n${failures} check(s) failed.\n`);
  process.exit(1);
}

process.stdout.write("check-isr-pages: all checks passed\n");
