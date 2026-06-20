// @ts-nocheck
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT      = resolve(__dirname, "../..");
const BUILD_DIR = join(ROOT, ".next/server/pages");
const hasBuild  = existsSync(BUILD_DIR) && existsSync(join(BUILD_DIR, "index.html"));

function extractScripts(html: string) {
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  const exec: string[] = [];
  const json: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const body = m[2].trim();
    if (!body) continue;
    const t = (m[1].match(/type\s*=\s*["']([^"']+)["']/i)?.[1] ?? "").toLowerCase();
    if (t === "application/json" || t === "application/ld+json") json.push(body);
    else exec.push(body);
  }
  return { exec, json };
}

describe.skipIf(!hasBuild)("CSP inline-script stability", () => {
  let homeExec:  string[];
  let pageBExec: string[];
  let pageCExec: string[];

  beforeAll(() => {
    homeExec = extractScripts(readFileSync(join(BUILD_DIR, "index.html"), "utf8")).exec;

    const playersDir = join(BUILD_DIR, "players");
    const gamesDir   = join(BUILD_DIR, "games");

    const playerFile = existsSync(playersDir)
      ? readdirSync(playersDir).find((f: string) => f.endsWith(".html"))
      : null;
    const gameFile = existsSync(gamesDir)
      ? readdirSync(gamesDir).find((f: string) => f.endsWith(".html"))
      : null;

    pageBExec = playerFile
      ? extractScripts(readFileSync(join(playersDir, playerFile), "utf8")).exec
      : homeExec;
    pageCExec = gameFile
      ? extractScripts(readFileSync(join(gamesDir, gameFile), "utf8")).exec
      : homeExec;
  });

  it("executable inline scripts are byte-identical across sampled pages", () => {
    expect(pageBExec.sort()).toEqual(homeExec.sort());
    expect(pageCExec.sort()).toEqual(homeExec.sort());
  });

  it("__NEXT_DATA__ script uses type=application/json on index page", () => {
    const html = readFileSync(join(BUILD_DIR, "index.html"), "utf8");
    const { json } = extractScripts(html);
    const hasNextData = html.includes('id="__NEXT_DATA__"');
    if (hasNextData) {
      expect(json.length).toBeGreaterThan(0);
      // The type attribute must live IN the opening tag; without it the script
      // becomes executable and breaks the hash-based CSP.
      const tag = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>/)?.[0] ?? "";
      expect(tag).toMatch(/type=("|')application\/json\1/);
    }
  });

  it("executable inline-script count per page is at most 5", () => {
    expect(homeExec.length).toBeLessThanOrEqual(5);
    expect(pageBExec.length).toBeLessThanOrEqual(5);
    expect(pageCExec.length).toBeLessThanOrEqual(5);
  });
});
