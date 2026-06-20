// @ts-nocheck
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT     = resolve(__dirname, "../..");
const PAGES    = join(ROOT, "pages");
const EXCLUDED = ["api", "admin", "coach"];

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED.includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("no legacy Cache-Control in public pages", () => {
  it("no public page sets res.setHeader Cache-Control", () => {
    const files      = walk(PAGES);
    const violations: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (/res\.setHeader\s*\(\s*["']Cache-Control["']/.test(src)) {
        violations.push(f.replace(ROOT + "/", ""));
      }
    }
    if (violations.length > 0) {
      throw new Error(
        `Legacy Cache-Control header found in:\n${violations.join("\n")}\n` +
        `Remove res.setHeader("Cache-Control", ...) from getStaticProps — ISR sets its own headers.`
      );
    }
  });
});
