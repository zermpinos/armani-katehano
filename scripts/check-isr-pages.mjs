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
if (gameFiles.length === 0)   fail("No per-game HTML files found under .next/server/pages/games/");
if (playerFiles.length === 0) fail("No per-player HTML files found under .next/server/pages/players/");

if (existsSync(join(BUILD_DIR, "admin"))) fail("Admin pages found in pre-rendered set — admin must stay SSR");

const bundleDir = join(ROOT, ".next/server");
function findMiddlewareBundle(dir) {
  let found = null;
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { const r = findMiddlewareBundle(p); if (r) found = r; }
      else if (/middleware/.test(e.name) && e.name.endsWith(".js")) found = p;
    }
  } catch {}
  return found;
}

const bundle = findMiddlewareBundle(bundleDir);
if (!bundle) {
  fail("Could not find Edge middleware bundle under .next/server/");
} else {
  const src = readFileSync(bundle, "utf8");
  const hashSrc = readFileSync(HASH_FILE, "utf8");
  const hashRe  = /"(sha256-[A-Za-z0-9+/]{43}=)"/g;
  let m;
  while ((m = hashRe.exec(hashSrc)) !== null) {
    const h = m[1];
    if (!src.includes(h)) fail(`Committed hash ${h} not found in Edge bundle ${bundle}`);
  }
}

if (failures > 0) {
  process.stderr.write(`\n${failures} check(s) failed.\n`);
  process.exit(1);
}

process.stdout.write("check-isr-pages: all checks passed\n");
