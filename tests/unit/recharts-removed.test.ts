import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

// Charts are now native SVG/CSS. This guards against recharts creeping back in
// (it would drag a ~300 KB library back into the client bundle).
const ROOT = resolve(__dirname, "..", "..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) { // eslint-disable-line security/detect-non-literal-fs-filename
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("recharts is fully removed", () => {
  it("no source file imports recharts", () => {
    const offenders = ["src", "pages"]
      .flatMap(d => walk(join(ROOT, d)))
      .filter(f => /from\s+["']recharts["']|require\(\s*["']recharts["']/.test(readFileSync(f, "utf8"))); // eslint-disable-line security/detect-non-literal-fs-filename
    expect(offenders).toEqual([]);
  });

  it("recharts is not a dependency", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.dependencies?.recharts).toBeUndefined();
    expect(pkg.devDependencies?.recharts).toBeUndefined();
  });
});
