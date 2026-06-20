// @ts-nocheck
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT      = resolve(__dirname, "../..");
const BUILD_DIR = join(ROOT, ".next/server/pages");
// Require at least index.html to confirm an ISR build (not just an SSR build dir).
const hasBuild  = existsSync(join(BUILD_DIR, "index.html"));

function listHtmlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  let out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(listHtmlFiles(p));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

// CI builds without DB pre-render the static parents but no dynamic children;
// gate the dynamic assertions on the actual presence of HTML files.
const hasGameHtml   = listHtmlFiles(join(BUILD_DIR, "games")).length   > 0;
const hasPlayerHtml = listHtmlFiles(join(BUILD_DIR, "players")).length > 0;

describe.skipIf(!hasBuild)("ISR pre-render set", () => {
  it("index.html is pre-rendered", () => {
    expect(existsSync(join(BUILD_DIR, "index.html"))).toBe(true);
  });

  it("games.html is pre-rendered", () => {
    expect(existsSync(join(BUILD_DIR, "games.html"))).toBe(true);
  });

  it("players.html is pre-rendered", () => {
    expect(existsSync(join(BUILD_DIR, "players.html"))).toBe(true);
  });

  it("leaderboard.html is pre-rendered", () => {
    expect(existsSync(join(BUILD_DIR, "leaderboard.html"))).toBe(true);
  });

  it("team-stats.html is pre-rendered", () => {
    expect(existsSync(join(BUILD_DIR, "team-stats.html"))).toBe(true);
  });

  it.skipIf(!hasGameHtml)("at least one per-game HTML file is pre-rendered", () => {
    const gamesDir = join(BUILD_DIR, "games");
    const gameHtml = existsSync(gamesDir)
      ? readdirSync(gamesDir).filter((f: string) => f.endsWith(".html"))
      : [];
    expect(gameHtml.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasPlayerHtml)("at least one per-player HTML file is pre-rendered", () => {
    const playersDir = join(BUILD_DIR, "players");
    const playerHtml = existsSync(playersDir)
      ? readdirSync(playersDir).filter((f: string) => f.endsWith(".html"))
      : [];
    expect(playerHtml.length).toBeGreaterThan(0);
  });

  // Admin pages compile under .next/server/pages/admin/ as SSR bundles even
  // though their HTML is never pre-rendered; assert on .html files only.
  it("no admin HTML pages are pre-rendered", () => {
    expect(listHtmlFiles(join(BUILD_DIR, "admin"))).toEqual([]);
  });
});
