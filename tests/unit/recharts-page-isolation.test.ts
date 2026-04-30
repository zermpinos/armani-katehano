import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Recharts ships ~50 KiB (gzipped) once you pull in ResponsiveContainer +
// any chart type. Statically importing a chart file from a page anchors
// recharts into that page's bundle -- and Next.js prefetches every <Link>
// destination on idle, so a Link from the homepage to /games drags the
// entire recharts tree into the prefetched chunk and shows up as "Reduce
// unused JavaScript" in Lighthouse on the homepage audit.
//
// The fix is to lazy-load every chart-bearing component via `dynamic()`.
// PlayerDetail (rendered on click only -- `{selected && <PlayerDetail/>}`)
// transitively imports GameLogPanel and SkillRadar, which both import
// recharts directly. MinutesChart on /team-stats does the same.
const ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const PAGES_USING_PLAYER_DETAIL = [
  "pages/index.tsx",
  "pages/players.tsx",
  "pages/games.tsx",
  "pages/leaderboard.tsx",
];

describe("page-level isolation of recharts via dynamic imports", () => {
  for (const page of PAGES_USING_PLAYER_DETAIL) {
    it(`${page} loads PlayerDetail via dynamic() (not a static import)`, () => {
      const src = read(page);
      // No top-level static import -- that pulls recharts (via GameLogPanel
      // and SkillRadar) into the page chunk and into prefetched chunks for
      // any <Link> pointing at this page.
      expect(src).not.toMatch(
        /^\s*import\s*\{\s*PlayerDetail\s*\}\s*from\s*["']@\/client\/players\/PlayerDetail["']/m
      );
      // Must reference dynamic() with the PlayerDetail module.
      expect(src).toMatch(/dynamic\(/);
      expect(src).toMatch(/import\(["']@\/client\/players\/PlayerDetail["']\)/);
    });
  }

  it("pages/team-stats.tsx loads MinutesChart via dynamic()", () => {
    const src = read("pages/team-stats.tsx");
    expect(src).not.toMatch(
      /^\s*import\s*\{\s*MinutesChart\s*\}\s*from\s*["']@\/client\/team-stats\/minutes-chart["']/m
    );
    expect(src).toMatch(/dynamic\(/);
    expect(src).toMatch(/import\(["']@\/client\/team-stats\/minutes-chart["']\)/);
  });
});
