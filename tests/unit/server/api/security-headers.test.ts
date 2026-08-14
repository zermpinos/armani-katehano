import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join, relative } from "node:path";

// proxy.ts excludes /api from its matcher (see its `config.matcher`), so API
// routes get security headers only by applying them by hand - directly, or via
// a guard wrapper that does it. A new route that forgets ships bare.
const ROOT = resolve(__dirname, "..", "..", "..", "..");
const APPLIES = /securityHeaders|requireAuth|requireCoachAuth/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) { // eslint-disable-line security/detect-non-literal-fs-filename
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("every API route applies security headers", () => {
  it("no handler under pages/api ships without them", () => {
    const offenders = walk(join(ROOT, "pages", "api"))
      .filter(f => !APPLIES.test(readFileSync(f, "utf8"))) // eslint-disable-line security/detect-non-literal-fs-filename
      .map(f => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
