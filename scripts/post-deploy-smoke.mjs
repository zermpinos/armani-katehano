#!/usr/bin/env node
// Usage: SITE_URL=https://armani-katehano.com node scripts/post-deploy-smoke.mjs
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = process.env.SITE_URL || "https://armani-katehano.com";
const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

let failures = 0;
function fail(msg) { process.stderr.write(`FAIL: ${msg}\n`); failures++; }

async function get(path) {
  const res = await fetch(`${SITE}${path}`, { cache: "no-store", redirect: "follow" });
  return { status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() };
}

for (const path of ["/", "/games", "/players"]) {
  const { status, headers } = await get(path);
  if (status !== 200)               fail(`${path} returned ${status}`);
  if (!headers["content-type"]?.includes("text/html")) fail(`${path} missing text/html content-type`);
}

const hashSrc = readFileSync(join(ROOT, "src/server/security/edge/csp-hashes.ts"), "utf8");
const hashRe  = /"(sha256-[A-Za-z0-9+/]{43}=)"/g;
const committed = [];
let m;
while ((m = hashRe.exec(hashSrc)) !== null) committed.push(m[1]);

const { headers: homeHeaders } = await get("/");
const csp = homeHeaders["content-security-policy"] || "";
if (!csp)                    fail("/ missing Content-Security-Policy header");
if (csp.includes("'nonce-")) fail("CSP contains a nonce token — nonces should be gone");
for (const h of committed) {
  if (!csp.includes(h)) fail(`Committed hash ${h} missing from production CSP`);
}

if (!SITE.includes("localhost")) {
  const GAME_ID = process.env.SMOKE_GAME_ID;
  if (GAME_ID) {
    await get(`/games/${GAME_ID}`);
    const { headers: h2 } = await get(`/games/${GAME_ID}`);
    const cacheStatus = (h2["x-vercel-cache"] || "").toUpperCase();
    if (!["HIT", "STALE"].includes(cacheStatus)) {
      fail(`/games/${GAME_ID} x-vercel-cache=${cacheStatus} — expected HIT or STALE`);
    }
  }
}

if (failures > 0) {
  process.stderr.write(`\n${failures} smoke check(s) failed.\n`);
  process.exit(1);
}
process.stdout.write("post-deploy-smoke: all checks passed\n");
