// @ts-nocheck
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT      = resolve(__dirname, "../..");
const BUILD_DIR = join(ROOT, ".next/server/pages");
// Require at least index.html to confirm an ISR build (not just an SSR build dir).
const hasBuild  = existsSync(join(BUILD_DIR, "index.html"));

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

  it("at least one per-game HTML file is pre-rendered", () => {
    const gamesDir = join(BUILD_DIR, "games");
    const gameHtml = existsSync(gamesDir)
      ? readdirSync(gamesDir).filter((f: string) => f.endsWith(".html"))
      : [];
    expect(gameHtml.length).toBeGreaterThan(0);
  });

  it("at least one per-player HTML file is pre-rendered", () => {
    const playersDir = join(BUILD_DIR, "players");
    const playerHtml = existsSync(playersDir)
      ? readdirSync(playersDir).filter((f: string) => f.endsWith(".html"))
      : [];
    expect(playerHtml.length).toBeGreaterThan(0);
  });

  it("no admin pages are pre-rendered", () => {
    const adminDir = join(BUILD_DIR, "admin");
    expect(existsSync(adminDir)).toBe(false);
  });
});
