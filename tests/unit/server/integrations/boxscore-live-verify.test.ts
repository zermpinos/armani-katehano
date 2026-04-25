/**
 * Live verification: scrape 4 real game URLs and compare output
 * against known-good DB values. Run manually with:
 *   npx vitest run tests/unit/server/integrations/boxscore-live-verify.test.ts
 */
import { describe, it, expect } from "vitest";
import { scrapeGame } from "@/server/integrations/scraper/boxscore";

const AK_IDENTIFIERS = ["ARMANI", "KATEHANO"];

async function fetchAndScrape(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "BoxScoreScraper/1.0", "Accept": "text/html,application/xhtml+xml" },
    redirect: "manual",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return scrapeGame(html, url);
}

function akPlayers(data: any) {
  const akTeam = data.teams.find((t: any) =>
    AK_IDENTIFIERS.some(id => t.name.toUpperCase().includes(id))
  );
  if (!akTeam) throw new Error(`AK team not found — teams: ${data.teams.map((t:any) => t.name).join(", ")}`);
  return akTeam.players as any[];
}

// DB snapshots — keyed by jersey number
type PlayerSnap = { pts: number; reb: number; ast: number; fg2m: number; fg2a: number; fg3m: number; fg3a: number; ftm: number; fta: number };

// ─── Game 1: Geroleague Stars, away, AK 46-58 L ──────────────────────────────
describe("2026-04-16 vs Geroleague Stars (away, 46-58 L)", () => {
  const URL = "https://basketcity.sportstats.gr/men/gamedetails/id/2A305873-F324-449E-804A-0AC1721CB850";
  const DB: Record<number, PlayerSnap> = {
    11: { pts:15, reb:9,  ast:3, fg2m:5, fg2a:16, fg3m:0, fg3a:1,  ftm:5, fta:11 },
     8: { pts:13, reb:12, ast:6, fg2m:6, fg2a:21, fg3m:0, fg3a:1,  ftm:1, fta:4  },
     6: { pts:8,  reb:3,  ast:1, fg2m:4, fg2a:10, fg3m:0, fg3a:1,  ftm:0, fta:0  },
     3: { pts:4,  reb:4,  ast:3, fg2m:2, fg2a:4,  fg3m:0, fg3a:5,  ftm:0, fta:0  },
    19: { pts:4,  reb:7,  ast:1, fg2m:2, fg2a:7,  fg3m:0, fg3a:2,  ftm:0, fta:0  },
     5: { pts:2,  reb:6,  ast:0, fg2m:1, fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
    23: { pts:0,  reb:1,  ast:0, fg2m:0, fg2a:2,  fg3m:0, fg3a:1,  ftm:0, fta:0  },
  };

  it("final score matches DB (46-58)", async () => {
    const data = await fetchAndScrape(URL);
    const fs = data.game.finalScore;
    // AK is away → home team scored 58, AK scored 46
    const scores = [Number(fs.home), Number(fs.away)].sort((a,b)=>a-b);
    expect(scores).toContain(46);
    expect(scores).toContain(58);
  });

  it("quarter scores are per-quarter not cumulative", async () => {
    const data = await fetchAndScrape(URL);
    const qs = data.game.quarterScores as any[];
    expect(qs).toHaveLength(4);
    const homeSum = qs.reduce((s: number, q: any) => s + Number(q.home), 0);
    const awaySum = qs.reduce((s: number, q: any) => s + Number(q.away), 0);
    const fh = Number(data.game.finalScore.home);
    const fa = Number(data.game.finalScore.away);
    // Per-quarter sums must equal final score (no OT in this game)
    expect(homeSum).toBe(fh);
    expect(awaySum).toBe(fa);
  });

  it("player stats match DB", async () => {
    const data = await fetchAndScrape(URL);
    const players = akPlayers(data);
    const byNum: Record<number, any> = Object.fromEntries(players.map(p => [p["#"], p]));

    for (const [numStr, snap] of Object.entries(DB)) {
      const num = Number(numStr);
      const p = byNum[num];
      if (!p) continue; // player absent from page (DNP/not listed)
      const { parseMinutes } = await import("@/domain/calendar/greek-date");
      if (parseMinutes(p.MIN) === 0) continue; // DNP — 0s in DB are correct

      expect(p.PTS,    `#${num} pts`).toBe(snap.pts);
      expect(p.REB,    `#${num} reb`).toBe(snap.reb);
      expect(p.AST,    `#${num} ast`).toBe(snap.ast);
      expect(p["2PTS"]?.made,      `#${num} fg2m`).toBe(snap.fg2m);
      expect(p["2PTS"]?.attempted, `#${num} fg2a`).toBe(snap.fg2a);
      expect(p["3PTS"]?.made,      `#${num} fg3m`).toBe(snap.fg3m);
      expect(p["3PTS"]?.attempted, `#${num} fg3a`).toBe(snap.fg3a);
      expect(p.FT?.made,           `#${num} ftm`).toBe(snap.ftm);
      expect(p.FT?.attempted,      `#${num} fta`).toBe(snap.fta);
    }
  });
});

// ─── Game 2: Xlatsers Legends, away, AK 51-44 W (winter-cup URL) ─────────────
describe("2026-04-09 vs Xlatsers Legends (away, 51-44 W, winter-cup)", () => {
  const URL = "https://basketcity.sportstats.gr/winter-cup/gamedetails/id/8E2DC102-A0D7-40D6-B913-B5016C8B4131";
  const DB: Record<number, PlayerSnap> = {
     8: { pts:15, reb:19, ast:3, fg2m:7, fg2a:14, fg3m:0, fg3a:3,  ftm:1, fta:2 },
    10: { pts:12, reb:15, ast:0, fg2m:5, fg2a:8,  fg3m:0, fg3a:0,  ftm:2, fta:5 },
    11: { pts:11, reb:5,  ast:4, fg2m:4, fg2a:15, fg3m:0, fg3a:0,  ftm:3, fta:5 },
    14: { pts:11, reb:8,  ast:1, fg2m:4, fg2a:10, fg3m:1, fg3a:3,  ftm:0, fta:0 },
     9: { pts:2,  reb:8,  ast:1, fg2m:1, fg2a:6,  fg3m:0, fg3a:2,  ftm:0, fta:1 },
  };

  it("final score matches DB (51-44)", async () => {
    const data = await fetchAndScrape(URL);
    const fs = data.game.finalScore;
    const scores = [Number(fs.home), Number(fs.away)].sort((a,b)=>a-b);
    expect(scores).toContain(44);
    expect(scores).toContain(51);
  });

  it("quarter scores are per-quarter not cumulative", async () => {
    const data = await fetchAndScrape(URL);
    const qs = data.game.quarterScores as any[];
    expect(qs).toHaveLength(4);
    const homeSum = qs.reduce((s: number, q: any) => s + Number(q.home), 0);
    const awaySum = qs.reduce((s: number, q: any) => s + Number(q.away), 0);
    expect(homeSum).toBe(Number(data.game.finalScore.home));
    expect(awaySum).toBe(Number(data.game.finalScore.away));
  });

  it("player stats match DB", async () => {
    const data = await fetchAndScrape(URL);
    const players = akPlayers(data);
    const byNum: Record<number, any> = Object.fromEntries(players.map(p => [p["#"], p]));
    const { parseMinutes } = await import("@/domain/calendar/greek-date");

    for (const [numStr, snap] of Object.entries(DB)) {
      const num = Number(numStr);
      const p = byNum[num];
      if (!p || parseMinutes(p.MIN) === 0) continue;

      expect(p.PTS,              `#${num} pts`).toBe(snap.pts);
      expect(p["2PTS"]?.made,    `#${num} fg2m`).toBe(snap.fg2m);
      expect(p["2PTS"]?.attempted,`#${num} fg2a`).toBe(snap.fg2a);
      expect(p["3PTS"]?.made,    `#${num} fg3m`).toBe(snap.fg3m);
      expect(p["3PTS"]?.attempted,`#${num} fg3a`).toBe(snap.fg3a);
      expect(p.FT?.made,         `#${num} ftm`).toBe(snap.ftm);
      expect(p.FT?.attempted,    `#${num} fta`).toBe(snap.fta);
    }
  });
});

// ─── Game 3: Patissia Thunders, home, AK 69-54 W ─────────────────────────────
describe("2026-04-04 vs Patissia Thunders (home, 69-54 W)", () => {
  const URL = "https://basketcity.sportstats.gr/men/gamedetails/id/1D8909D0-DA6B-497C-A3C0-E157A518B293";
  const DB: Record<number, PlayerSnap> = {
     3: { pts:18, reb:5,  ast:1, fg2m:3, fg2a:5,  fg3m:4, fg3a:9,  ftm:0, fta:1 },
    11: { pts:14, reb:3,  ast:3, fg2m:4, fg2a:10, fg3m:1, fg3a:1,  ftm:3, fta:4 },
    14: { pts:13, reb:6,  ast:0, fg2m:5, fg2a:6,  fg3m:1, fg3a:3,  ftm:0, fta:2 },
     8: { pts:12, reb:4,  ast:8, fg2m:6, fg2a:12, fg3m:0, fg3a:1,  ftm:0, fta:2 },
     5: { pts:5,  reb:6,  ast:0, fg2m:2, fg2a:2,  fg3m:0, fg3a:0,  ftm:1, fta:2 },
     6: { pts:3,  reb:5,  ast:2, fg2m:0, fg2a:3,  fg3m:1, fg3a:4,  ftm:0, fta:0 },
    23: { pts:2,  reb:0,  ast:3, fg2m:1, fg2a:2,  fg3m:0, fg3a:1,  ftm:0, fta:0 },
     9: { pts:2,  reb:2,  ast:1, fg2m:1, fg2a:7,  fg3m:0, fg3a:1,  ftm:0, fta:2 },
  };

  it("final score matches DB (69-54)", async () => {
    const data = await fetchAndScrape(URL);
    const fs = data.game.finalScore;
    const scores = [Number(fs.home), Number(fs.away)].sort((a,b)=>a-b);
    expect(scores).toContain(54);
    expect(scores).toContain(69);
  });

  it("quarter scores are per-quarter not cumulative", async () => {
    const data = await fetchAndScrape(URL);
    const qs = data.game.quarterScores as any[];
    const homeSum = qs.reduce((s: number, q: any) => s + Number(q.home), 0);
    const awaySum = qs.reduce((s: number, q: any) => s + Number(q.away), 0);
    expect(homeSum).toBe(Number(data.game.finalScore.home));
    expect(awaySum).toBe(Number(data.game.finalScore.away));
  });

  it("player stats match DB", async () => {
    const data = await fetchAndScrape(URL);
    const players = akPlayers(data);
    const byNum: Record<number, any> = Object.fromEntries(players.map(p => [p["#"], p]));
    const { parseMinutes } = await import("@/domain/calendar/greek-date");

    for (const [numStr, snap] of Object.entries(DB)) {
      const num = Number(numStr);
      const p = byNum[num];
      if (!p || parseMinutes(p.MIN) === 0) continue;

      expect(p.PTS,              `#${num} pts`).toBe(snap.pts);
      expect(p["2PTS"]?.made,    `#${num} fg2m`).toBe(snap.fg2m);
      expect(p["2PTS"]?.attempted,`#${num} fg2a`).toBe(snap.fg2a);
      expect(p["3PTS"]?.made,    `#${num} fg3m`).toBe(snap.fg3m);
      expect(p["3PTS"]?.attempted,`#${num} fg3a`).toBe(snap.fg3a);
      expect(p.FT?.made,         `#${num} ftm`).toBe(snap.ftm);
      expect(p.FT?.attempted,    `#${num} fta`).toBe(snap.fta);
    }
  });
});

// ─── Game 4: Hustling Huskies, away, AK 51-68 L ──────────────────────────────
describe("2026-03-28 vs Hustling Huskies (away, 51-68 L)", () => {
  const URL = "https://basketcity.sportstats.gr/men/gamedetails/id/C088BB59-7595-4FD7-A4DA-1252BCB19E81";
  const DB: Record<number, PlayerSnap> = {
    14: { pts:14, reb:3,  ast:0, fg2m:6, fg2a:6,  fg3m:0, fg3a:0,  ftm:2, fta:5 },
     8: { pts:12, reb:0,  ast:4, fg2m:3, fg2a:6,  fg3m:1, fg3a:4,  ftm:3, fta:4 },
    77: { pts:11, reb:1,  ast:1, fg2m:0, fg2a:1,  fg3m:3, fg3a:6,  ftm:2, fta:2 },
     5: { pts:10, reb:7,  ast:0, fg2m:5, fg2a:8,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
    23: { pts:3,  reb:0,  ast:1, fg2m:0, fg2a:1,  fg3m:1, fg3a:1,  ftm:0, fta:0 },
     0: { pts:1,  reb:2,  ast:1, fg2m:0, fg2a:0,  fg3m:0, fg3a:1,  ftm:1, fta:2 },
  };

  it("final score matches DB (51-68)", async () => {
    const data = await fetchAndScrape(URL);
    const fs = data.game.finalScore;
    const scores = [Number(fs.home), Number(fs.away)].sort((a,b)=>a-b);
    expect(scores).toContain(51);
    expect(scores).toContain(68);
  });

  it("quarter scores are per-quarter not cumulative", async () => {
    const data = await fetchAndScrape(URL);
    const qs = data.game.quarterScores as any[];
    const homeSum = qs.reduce((s: number, q: any) => s + Number(q.home), 0);
    const awaySum = qs.reduce((s: number, q: any) => s + Number(q.away), 0);
    expect(homeSum).toBe(Number(data.game.finalScore.home));
    expect(awaySum).toBe(Number(data.game.finalScore.away));
  });

  it("player stats match DB", async () => {
    const data = await fetchAndScrape(URL);
    const players = akPlayers(data);
    const byNum: Record<number, any> = Object.fromEntries(players.map(p => [p["#"], p]));
    const { parseMinutes } = await import("@/domain/calendar/greek-date");

    for (const [numStr, snap] of Object.entries(DB)) {
      const num = Number(numStr);
      const p = byNum[num];
      if (!p || parseMinutes(p.MIN) === 0) continue;

      expect(p.PTS,              `#${num} pts`).toBe(snap.pts);
      expect(p["2PTS"]?.made,    `#${num} fg2m`).toBe(snap.fg2m);
      expect(p["2PTS"]?.attempted,`#${num} fg2a`).toBe(snap.fg2a);
      expect(p["3PTS"]?.made,    `#${num} fg3m`).toBe(snap.fg3m);
      expect(p["3PTS"]?.attempted,`#${num} fg3a`).toBe(snap.fg3a);
      expect(p.FT?.made,         `#${num} ftm`).toBe(snap.ftm);
      expect(p.FT?.attempted,    `#${num} fta`).toBe(snap.fta);
    }
  });
});
