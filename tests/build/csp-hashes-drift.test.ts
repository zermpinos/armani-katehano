// @ts-nocheck
import { describe, it, expect, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { scriptHashes, styleHashes } from "@/server/security/edge/csp-hashes";

const ROOT      = resolve(__dirname, "../..");
const BUILD_DIR = join(ROOT, ".next/server/pages");
// Require at least index.html to confirm an ISR build before checking hash drift.
const hasBuild  = existsSync(join(BUILD_DIR, "index.html"));

function walk(dir: string): string[] {
  let out: string[] = [];
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out = out.concat(walk(p));
      else if (e.name.endsWith(".html")) out.push(p);
    }
  } catch {}
  return out;
}

function sha256(s: string) {
  return "sha256-" + createHash("sha256").update(s).digest("base64");
}

function extractScripts(html: string): string[] {
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const body = m[2].trim();
    if (!body) continue;
    const t = (m[1].match(/type\s*=\s*["']([^"']+)["']/i)?.[1] ?? "").toLowerCase();
    if (t === "application/json" || t === "application/ld+json") continue;
    out.push(body);
  }
  return out;
}

function extractStyles(html: string): string[] {
  const re = /<style(?:\s[^>]*)?>([^<]+)<\/style>/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const body = m[1].trim();
    if (body) out.push(body);
  }
  return out;
}

describe.skipIf(!hasBuild)("CSP hash drift", () => {
  let buildScriptHashes: Set<string>;
  let buildStyleHashes:  Set<string>;

  beforeAll(() => {
    buildScriptHashes = new Set<string>();
    buildStyleHashes  = new Set<string>();
    for (const f of walk(BUILD_DIR)) {
      const html = readFileSync(f, "utf8");
      for (const s of extractScripts(html)) buildScriptHashes.add(sha256(s));
      for (const s of extractStyles(html))  buildStyleHashes.add(sha256(s));
    }
  });

  it("every committed scriptHash is present in the build output", () => {
    for (const h of scriptHashes) {
      if (!buildScriptHashes.has(h)) {
        throw new Error(
          `Committed script hash ${h} not found in build output.\n` +
          `Run: node scripts/regenerate-csp-hashes.mjs`
        );
      }
    }
  });

  it("build output contains no script hashes absent from the committed list", () => {
    for (const h of buildScriptHashes) {
      if (!scriptHashes.includes(h)) {
        throw new Error(
          `Build output has script hash ${h} not in csp-hashes.ts.\n` +
          `Run: node scripts/regenerate-csp-hashes.mjs`
        );
      }
    }
  });

  it("every committed styleHash is present in the build output", () => {
    for (const h of styleHashes) {
      if (!buildStyleHashes.has(h)) {
        throw new Error(
          `Committed style hash ${h} not found in build output.\n` +
          `Run: node scripts/regenerate-csp-hashes.mjs`
        );
      }
    }
  });
});
