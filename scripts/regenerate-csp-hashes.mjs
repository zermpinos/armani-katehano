#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT    = resolve(fileURLToPath(import.meta.url), "../..");
const HTMLDIR = join(ROOT, ".next/server/pages");
const OUT     = join(ROOT, "src/server/security/edge/csp-hashes.ts");

function sha256(s) {
  return "sha256-" + createHash("sha256").update(s).digest("base64");
}

function walk(dir) {
  let out = [];
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out = out.concat(walk(p));
      else if (e.name.endsWith(".html")) out.push(p);
    }
  } catch {}
  return out;
}

function scripts(html) {
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const body = m[2].trim();
    if (!body) continue;
    const t = (m[1].match(/type\s*=\s*["']([^"']+)["']/i)?.[1] ?? "").toLowerCase();
    if (t === "application/json" || t === "application/ld+json") continue;
    out.push(body);
  }
  return out;
}

function styles(html) {
  // eslint-disable-next-line security/detect-unsafe-regex
  const re = /<style(?:\s[^>]*)?>([^<]+)<\/style>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const body = m[1].trim();
    if (body) out.push(body);
  }
  return out;
}

const files = walk(HTMLDIR);
if (files.length === 0) {
  process.stderr.write(
    "No pre-rendered HTML found in .next/server/pages/\n" +
    "Run `npm run build` against an ISR build first.\n"
  );
  process.exit(1);
}

const scriptSet = new Set();
const styleSet  = new Set();

for (const f of files) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const html = readFileSync(f, "utf8");
  for (const s of scripts(html)) scriptSet.add(sha256(s));
  for (const s of styles(html))  styleSet.add(sha256(s));
}

const sH = [...scriptSet].sort();
const stH = [...styleSet].sort();

writeFileSync(OUT, [
  `export const scriptHashes: readonly string[] = ${JSON.stringify(sH, null, 2)};`,
  ``,
  `export const styleHashes: readonly string[] = ${JSON.stringify(stH, null, 2)};`,
  ``,
].join("\n"), "utf8");

process.stdout.write(`csp-hashes.ts updated  script:${sH.length}  style:${stH.length}\n`);
