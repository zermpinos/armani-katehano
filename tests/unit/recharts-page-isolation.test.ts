import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Recharts ships ~50 KiB (gzipped) once you pull in ResponsiveContainer +
// any chart type. Statically importing a chart file from a page anchors
// recharts into that page's bundle - and Next.js prefetches every <Link>
// destination on idle, so a Link from the homepage to /games drags the
// entire recharts tree into the prefetched chunk and shows up as "Reduce
// unused JavaScript" in Lighthouse on the homepage audit.
//
// The fix is to lazy-load every chart-bearing component via `dynamic()`.
// (team-stats/minutes-chart is exempt: it renders native bars, no recharts.)
const ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8"); // eslint-disable-line security/detect-non-literal-fs-filename
}

describe("player standalone page recharts isolation", () => {
  it("pages/players/[slug].tsx loads SkillRadar via dynamic() through the charts barrel (not a static import)", () => {
    const src = read("pages/players/[slug].tsx");
    expect(src).not.toMatch(
      /^\s*import\s*\{[^}]*\bSkillRadar\b[^}]*\}\s*from\s*["']@\/client\/players\/(SkillRadar|charts)["']/m
    );
    expect(src).toMatch(/dynamic\(/);
    expect(src).toMatch(/import\(["']@\/client\/players\/charts["']\)[^]*SkillRadar/);
  });

  it("pages/players/[slug].tsx loads GameLogPanel via dynamic() through the charts barrel (not a static import)", () => {
    const src = read("pages/players/[slug].tsx");
    expect(src).not.toMatch(
      /^\s*import\s*\{[^}]*\bGameLogPanel\b[^}]*\}\s*from\s*["']@\/client\/players\/(GameLogPanel|charts)["']/m
    );
    expect(src).toMatch(/dynamic\(/);
    expect(src).toMatch(/import\(["']@\/client\/players\/charts["']\)[^]*GameLogPanel/);
  });
});
