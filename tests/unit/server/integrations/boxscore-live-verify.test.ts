/**
 * Live verification: scrape every game URL from the DB and confirm the fixed
 * scraper produces the same stats that were originally imported.
 *
 * Run: npx vitest run tests/unit/server/integrations/boxscore-live-verify.test.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import { scrapeGame } from "@/server/integrations/scraper/boxscore";
import { parseMinutes } from "@/domain/calendar/greek-date";
import { GAMES } from "./__fixtures__/ak-games";

const AK_IDS = ["ARMANI", "KATEHANO"];

async function fetchAndScrape(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "BoxScoreScraper/1.0", "Accept": "text/html" },
    redirect: "manual",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return scrapeGame(await res.text(), url);
}

function akTeamPlayers(data: any): any[] {
  const team = data.teams.find((t: any) =>
    AK_IDS.some(id => t.name.toUpperCase().includes(id))
  );
  if (!team) throw new Error(`AK team not found. Got: ${data.teams.map((t: any) => t.name).join(", ")}`);
  return team.players;
}

// ─── Pre-fetch all URLs once — sequentially to avoid rate-limiting ────────────

const scraped: Record<string, any> = {};
const fetchFailed = new Set<string>();

beforeAll(async () => {
  for (const g of GAMES) {
    try {
      scraped[g.url] = await fetchAndScrape(g.url);
    } catch {
      fetchFailed.add(g.url);
    }
  }
  if (fetchFailed.size) {
    console.warn(`[live-verify] ${fetchFailed.size} URL(s) unreachable — those tests will be skipped`);
  }
}, 180_000);

// ─── Per-game tests ───────────────────────────────────────────────────────────

for (const game of GAMES) {
  const id = game.url.split("/").pop()!.slice(0, 8);

  describe(`${id} (AK ${game.akScore})`, () => {
    it("AK score present in finalScore", ({ skip }) => {
      if (fetchFailed.has(game.url)) skip();
      const data = scraped[game.url];
      const fs = data.game.finalScore;
      expect(
        [Number(fs.home), Number(fs.away)],
        `finalScore ${fs.home}-${fs.away} does not contain AK score ${game.akScore}`
      ).toContain(game.akScore);
    });

    it("quarter sums equal final score (per-quarter table selected)", ({ skip }) => {
      if (fetchFailed.has(game.url)) skip();
      const data = scraped[game.url];
      const qs: any[] = data.game.quarterScores;
      expect(qs, "no quarterScores").toBeDefined();
      expect(qs).toHaveLength(4);
      const fh = Number(data.game.finalScore.home);
      const fa = Number(data.game.finalScore.away);
      const homeSum = qs.reduce((s, q) => s + Number(q.home), 0);
      const awaySum = qs.reduce((s, q) => s + Number(q.away), 0);
      expect(homeSum, `homeSum ${homeSum} ≠ finalScore.home ${fh}`).toBe(fh);
      expect(awaySum, `awaySum ${awaySum} ≠ finalScore.away ${fa}`).toBe(fa);
    });

    it("player stats match DB snapshot", ({ skip }) => {
      if (fetchFailed.has(game.url)) skip();
      const data = scraped[game.url];
      const players = akTeamPlayers(data);
      const byNum: Record<number, any> = Object.fromEntries(
        players.map((p: any) => [p["#"], p])
      );

      for (const [numStr, snap] of Object.entries(game.players)) {
        const num = Number(numStr);
        const p = Reflect.get(byNum, num);
        if (!p || parseMinutes(p.MIN) === 0) continue;
        expect(p.PTS,                `#${num} pts`).toBe(snap.pts);
        expect(p["2PTS"]?.made,      `#${num} fg2m`).toBe(snap.fg2m);
        expect(p["2PTS"]?.attempted, `#${num} fg2a`).toBe(snap.fg2a);
        expect(p["3PTS"]?.made,      `#${num} fg3m`).toBe(snap.fg3m);
        expect(p["3PTS"]?.attempted, `#${num} fg3a`).toBe(snap.fg3a);
        expect(p.FT?.made,           `#${num} ftm`).toBe(snap.ftm);
        expect(p.FT?.attempted,      `#${num} fta`).toBe(snap.fta);
      }
    });
  });
}
