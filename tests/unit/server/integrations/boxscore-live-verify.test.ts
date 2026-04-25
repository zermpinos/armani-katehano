/**
 * Live verification: scrape every game URL from the DB and confirm the fixed
 * scraper produces the same stats that were originally imported.
 *
 * Run: npx vitest run tests/unit/server/integrations/boxscore-live-verify.test.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import { scrapeGame } from "@/server/integrations/scraper/boxscore";
import { parseMinutes } from "@/domain/calendar/greek-date";

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

type Snap = { pts: number; fg2m: number; fg2a: number; fg3m: number; fg3a: number; ftm: number; fta: number };

// players: jersey number -> stats snapshot (only non-zero scorers)
type GameFixture = { url: string; akScore: number; players: Record<number, Snap> };

const GAMES: GameFixture[] = [
  // ── Geroleague Stars, away, AK 46-58 L ───────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/2A305873-F324-449E-804A-0AC1721CB850",
    akScore: 46,
    players: {
      11: { pts:15, fg2m:5,  fg2a:16, fg3m:0, fg3a:1,  ftm:5, fta:11 },
       8: { pts:13, fg2m:6,  fg2a:21, fg3m:0, fg3a:1,  ftm:1, fta:4  },
       6: { pts:8,  fg2m:4,  fg2a:10, fg3m:0, fg3a:1,  ftm:0, fta:0  },
       3: { pts:4,  fg2m:2,  fg2a:4,  fg3m:0, fg3a:5,  ftm:0, fta:0  },
      19: { pts:4,  fg2m:2,  fg2a:7,  fg3m:0, fg3a:2,  ftm:0, fta:0  },
       5: { pts:2,  fg2m:1,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
    },
  },
  // ── Xlatsers Legends, away, AK 51-44 W (winter-cup) ─────────────────────
  { url: "https://basketcity.sportstats.gr/winter-cup/gamedetails/id/8E2DC102-A0D7-40D6-B913-B5016C8B4131",
    akScore: 51,
    players: {
       8: { pts:15, fg2m:7,  fg2a:14, fg3m:0, fg3a:3,  ftm:1, fta:2 },
      10: { pts:12, fg2m:5,  fg2a:8,  fg3m:0, fg3a:0,  ftm:2, fta:5 },
      11: { pts:11, fg2m:4,  fg2a:15, fg3m:0, fg3a:0,  ftm:3, fta:5 },
      14: { pts:11, fg2m:4,  fg2a:10, fg3m:1, fg3a:3,  ftm:0, fta:0 },
       9: { pts:2,  fg2m:1,  fg2a:6,  fg3m:0, fg3a:2,  ftm:0, fta:1 },
    },
  },
  // ── Patissia Thunders, home, AK 69-54 W ──────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/1D8909D0-DA6B-497C-A3C0-E157A518B293",
    akScore: 69,
    players: {
       3: { pts:18, fg2m:3,  fg2a:5,  fg3m:4, fg3a:9,  ftm:0, fta:1 },
      11: { pts:14, fg2m:4,  fg2a:10, fg3m:1, fg3a:1,  ftm:3, fta:4 },
      14: { pts:13, fg2m:5,  fg2a:6,  fg3m:1, fg3a:3,  ftm:0, fta:2 },
       8: { pts:12, fg2m:6,  fg2a:12, fg3m:0, fg3a:1,  ftm:0, fta:2 },
       5: { pts:5,  fg2m:2,  fg2a:2,  fg3m:0, fg3a:0,  ftm:1, fta:2 },
       6: { pts:3,  fg2m:0,  fg2a:3,  fg3m:1, fg3a:4,  ftm:0, fta:0 },
      23: { pts:2,  fg2m:1,  fg2a:2,  fg3m:0, fg3a:1,  ftm:0, fta:0 },
       9: { pts:2,  fg2m:1,  fg2a:7,  fg3m:0, fg3a:1,  ftm:0, fta:2 },
    },
  },
  // ── Hustling Huskies, away, AK 51-68 L ───────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/C088BB59-7595-4FD7-A4DA-1252BCB19E81",
    akScore: 51,
    players: {
      14: { pts:14, fg2m:6,  fg2a:6,  fg3m:0, fg3a:0,  ftm:2, fta:5 },
       8: { pts:12, fg2m:3,  fg2a:6,  fg3m:1, fg3a:4,  ftm:3, fta:4 },
      77: { pts:11, fg2m:0,  fg2a:1,  fg3m:3, fg3a:6,  ftm:2, fta:2 },
       5: { pts:10, fg2m:5,  fg2a:8,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
      23: { pts:3,  fg2m:0,  fg2a:1,  fg3m:1, fg3a:1,  ftm:0, fta:0 },
       0: { pts:1,  fg2m:0,  fg2a:0,  fg3m:0, fg3a:1,  ftm:1, fta:2 },
    },
  },
  // ── Cappuccino Knights, home, AK 55-39 W ─────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/8BE923B4-2CC3-4997-B501-72B54A92FA2E",
    akScore: 55,
    players: {
       3: { pts:13, fg2m:2,  fg2a:3,  fg3m:3, fg3a:6,  ftm:0, fta:0 },
       8: { pts:13, fg2m:6,  fg2a:15, fg3m:0, fg3a:1,  ftm:1, fta:1 },
      11: { pts:10, fg2m:4,  fg2a:9,  fg3m:0, fg3a:1,  ftm:2, fta:5 },
      19: { pts:4,  fg2m:2,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
      77: { pts:4,  fg2m:2,  fg2a:5,  fg3m:0, fg3a:4,  ftm:0, fta:0 },
      10: { pts:4,  fg2m:2,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
      26: { pts:3,  fg2m:0,  fg2a:2,  fg3m:1, fg3a:2,  ftm:0, fta:0 },
       5: { pts:2,  fg2m:1,  fg2a:6,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
      23: { pts:2,  fg2m:1,  fg2a:4,  fg3m:0, fg3a:2,  ftm:0, fta:0 },
    },
  },
  // ── Cappuccino Knights, away, AK 53-60 L ─────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/37C1E382-6647-4705-8A6C-7AD1ECBEE38B",
    akScore: 53,
    players: {
      77: { pts:18, fg2m:3,  fg2a:8,  fg3m:4, fg3a:11, ftm:0, fta:0 },
      14: { pts:17, fg2m:8,  fg2a:16, fg3m:0, fg3a:4,  ftm:1, fta:4 },
       3: { pts:6,  fg2m:0,  fg2a:3,  fg3m:2, fg3a:10, ftm:0, fta:0 },
       6: { pts:6,  fg2m:3,  fg2a:6,  fg3m:0, fg3a:4,  ftm:0, fta:0 },
      11: { pts:4,  fg2m:2,  fg2a:11, fg3m:0, fg3a:2,  ftm:0, fta:2 },
       5: { pts:2,  fg2m:0,  fg2a:2,  fg3m:0, fg3a:0,  ftm:2, fta:2 },
    },
  },
  // ── unknown opp, AK 57 W (/men/) ─────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/9F598183-AB99-44D7-956F-8EB8FE2379C3",
    akScore: 57,
    players: {
      11: { pts:19, fg2m:7,  fg2a:14, fg3m:1, fg3a:3,  ftm:2, fta:4 },
       3: { pts:13, fg2m:2,  fg2a:4,  fg3m:3, fg3a:8,  ftm:0, fta:0 },
      14: { pts:11, fg2m:4,  fg2a:11, fg3m:1, fg3a:2,  ftm:0, fta:4 },
      19: { pts:6,  fg2m:1,  fg2a:2,  fg3m:1, fg3a:1,  ftm:1, fta:2 },
      10: { pts:4,  fg2m:1,  fg2a:2,  fg3m:0, fg3a:0,  ftm:2, fta:4 },
       9: { pts:4,  fg2m:2,  fg2a:4,  fg3m:0, fg3a:1,  ftm:0, fta:0 },
    },
  },
  // ── unknown opp, AK 53 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/2BAD02B8-03B1-444D-BAF4-005AACC0D911",
    akScore: 53,
    players: {
      11: { pts:17, fg2m:6,  fg2a:14, fg3m:1, fg3a:1,  ftm:2, fta:8 },
      14: { pts:13, fg2m:6,  fg2a:9,  fg3m:0, fg3a:2,  ftm:1, fta:3 },
       3: { pts:12, fg2m:3,  fg2a:5,  fg3m:2, fg3a:7,  ftm:0, fta:0 },
      19: { pts:4,  fg2m:2,  fg2a:2,  fg3m:0, fg3a:1,  ftm:0, fta:0 },
      77: { pts:3,  fg2m:0,  fg2a:2,  fg3m:1, fg3a:6,  ftm:0, fta:0 },
      23: { pts:2,  fg2m:1,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
       6: { pts:2,  fg2m:0,  fg2a:1,  fg3m:0, fg3a:4,  ftm:2, fta:4 },
    },
  },
  // ── unknown opp, AK 58 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/2D39B2D0-1029-498C-B057-52D220A0C347",
    akScore: 58,
    players: {
      11: { pts:21, fg2m:7,  fg2a:14, fg3m:0, fg3a:1,  ftm:7, fta:10 },
      14: { pts:14, fg2m:7,  fg2a:14, fg3m:0, fg3a:3,  ftm:0, fta:3  },
       9: { pts:11, fg2m:2,  fg2a:7,  fg3m:1, fg3a:1,  ftm:4, fta:6  },
       6: { pts:10, fg2m:1,  fg2a:2,  fg3m:2, fg3a:3,  ftm:2, fta:2  },
      23: { pts:2,  fg2m:1,  fg2a:2,  fg3m:0, fg3a:1,  ftm:0, fta:2  },
    },
  },
  // ── unknown opp, AK 46 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/4074D956-E264-4597-856B-7E7BAE060B7A",
    akScore: 46,
    players: {
      14: { pts:18, fg2m:8,  fg2a:13, fg3m:0, fg3a:1,  ftm:2, fta:7 },
       3: { pts:12, fg2m:0,  fg2a:0,  fg3m:4, fg3a:10, ftm:0, fta:0 },
      11: { pts:9,  fg2m:4,  fg2a:11, fg3m:0, fg3a:0,  ftm:1, fta:3 },
      10: { pts:4,  fg2m:2,  fg2a:5,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
       9: { pts:3,  fg2m:1,  fg2a:9,  fg3m:0, fg3a:5,  ftm:1, fta:2 },
    },
  },
  // ── unknown opp, AK 49 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/8C940A2A-D3CA-4F2E-B8DE-C148B55221E6",
    akScore: 49,
    players: {
       8: { pts:18, fg2m:8,  fg2a:21, fg3m:0, fg3a:5,  ftm:2, fta:2 },
       6: { pts:16, fg2m:3,  fg2a:5,  fg3m:3, fg3a:5,  ftm:1, fta:2 },
      14: { pts:7,  fg2m:1,  fg2a:3,  fg3m:1, fg3a:5,  ftm:2, fta:4 },
       3: { pts:3,  fg2m:1,  fg2a:3,  fg3m:0, fg3a:5,  ftm:1, fta:2 },
       5: { pts:2,  fg2m:1,  fg2a:1,  fg3m:0, fg3a:0,  ftm:0, fta:2 },
      11: { pts:2,  fg2m:1,  fg2a:8,  fg3m:0, fg3a:1,  ftm:0, fta:2 },
       0: { pts:1,  fg2m:0,  fg2a:2,  fg3m:0, fg3a:0,  ftm:1, fta:2 },
    },
  },
  // ── unknown opp, AK 72 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/2E6EDAEC-5BFB-450B-A20E-4E3C5935D3E8",
    akScore: 72,
    players: {
      14: { pts:21, fg2m:8,  fg2a:10, fg3m:1, fg3a:2,  ftm:2, fta:3 },
       8: { pts:21, fg2m:10, fg2a:17, fg3m:0, fg3a:0,  ftm:1, fta:2 },
      11: { pts:10, fg2m:4,  fg2a:8,  fg3m:0, fg3a:0,  ftm:2, fta:4 },
       3: { pts:7,  fg2m:2,  fg2a:3,  fg3m:1, fg3a:4,  ftm:0, fta:0 },
       0: { pts:6,  fg2m:3,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
      77: { pts:5,  fg2m:1,  fg2a:2,  fg3m:1, fg3a:3,  ftm:0, fta:2 },
       5: { pts:2,  fg2m:1,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
    },
  },
  // ── unknown opp, AK 56 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/5B7B1735-450B-4ADC-933B-035D2C572F40",
    akScore: 56,
    players: {
      14: { pts:14, fg2m:5,  fg2a:7,  fg3m:0, fg3a:1,  ftm:4, fta:11 },
       6: { pts:12, fg2m:0,  fg2a:3,  fg3m:4, fg3a:6,  ftm:0, fta:0  },
       3: { pts:11, fg2m:4,  fg2a:5,  fg3m:1, fg3a:5,  ftm:0, fta:0  },
      11: { pts:8,  fg2m:2,  fg2a:7,  fg3m:0, fg3a:0,  ftm:4, fta:7  },
      77: { pts:5,  fg2m:1,  fg2a:2,  fg3m:1, fg3a:7,  ftm:0, fta:0  },
       5: { pts:4,  fg2m:2,  fg2a:4,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
       9: { pts:2,  fg2m:1,  fg2a:5,  fg3m:0, fg3a:1,  ftm:0, fta:0  },
    },
  },
  // ── unknown opp, AK 66 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/6A987D28-B001-40D9-8A0D-1492653BF5F0",
    akScore: 66,
    players: {
      11: { pts:14, fg2m:6,  fg2a:13, fg3m:0, fg3a:0,  ftm:2, fta:6 },
       3: { pts:13, fg2m:2,  fg2a:3,  fg3m:3, fg3a:5,  ftm:0, fta:0 },
      14: { pts:11, fg2m:4,  fg2a:10, fg3m:1, fg3a:2,  ftm:0, fta:2 },
       6: { pts:9,  fg2m:4,  fg2a:8,  fg3m:0, fg3a:2,  ftm:1, fta:2 },
       9: { pts:8,  fg2m:4,  fg2a:7,  fg3m:0, fg3a:0,  ftm:0, fta:2 },
      26: { pts:7,  fg2m:2,  fg2a:3,  fg3m:1, fg3a:3,  ftm:0, fta:0 },
       5: { pts:4,  fg2m:2,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
    },
  },
  // ── unknown opp, AK 40 (/winter-cup/) ────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/winter-cup/gamedetails/id/396F4BA4-E842-4F51-9DFB-A69C19BD9CFF",
    akScore: 40,
    players: {
      14: { pts:12, fg2m:4,  fg2a:11, fg3m:1, fg3a:5,  ftm:1, fta:2 },
      11: { pts:9,  fg2m:4,  fg2a:7,  fg3m:0, fg3a:4,  ftm:1, fta:4 },
       6: { pts:4,  fg2m:2,  fg2a:5,  fg3m:0, fg3a:1,  ftm:0, fta:1 },
       3: { pts:4,  fg2m:2,  fg2a:4,  fg3m:0, fg3a:2,  ftm:0, fta:0 },
      77: { pts:3,  fg2m:0,  fg2a:2,  fg3m:1, fg3a:9,  ftm:0, fta:0 },
      23: { pts:3,  fg2m:0,  fg2a:0,  fg3m:1, fg3a:1,  ftm:0, fta:0 },
       5: { pts:3,  fg2m:1,  fg2a:3,  fg3m:0, fg3a:0,  ftm:1, fta:2 },
       0: { pts:2,  fg2m:1,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
    },
  },
  // ── unknown opp, AK 54 (/winter-cup/) ────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/winter-cup/gamedetails/id/BB5C0929-EAB0-4A76-998A-3AB6B2E90314",
    akScore: 54,
    players: {
      11: { pts:20, fg2m:9,  fg2a:18, fg3m:0, fg3a:1,  ftm:2, fta:2 },
       9: { pts:10, fg2m:5,  fg2a:11, fg3m:0, fg3a:1,  ftm:0, fta:0 },
       3: { pts:10, fg2m:2,  fg2a:7,  fg3m:2, fg3a:9,  ftm:0, fta:0 },
      77: { pts:5,  fg2m:1,  fg2a:4,  fg3m:1, fg3a:6,  ftm:0, fta:0 },
      19: { pts:5,  fg2m:1,  fg2a:5,  fg3m:1, fg3a:2,  ftm:0, fta:0 },
       5: { pts:4,  fg2m:2,  fg2a:6,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
    },
  },
  // ── original bug game, AK 45-39 W (/winter-cup/) ─────────────────────────
  { url: "https://basketcity.sportstats.gr/winter-cup/gamedetails/id/5232D338-E291-4838-8560-5A6B56F1B244",
    akScore: 45,
    players: {
       3: { pts:14, fg2m:4,  fg2a:6,  fg3m:1, fg3a:3,  ftm:3, fta:4 },
      14: { pts:9,  fg2m:3,  fg2a:5,  fg3m:1, fg3a:3,  ftm:0, fta:0 },
       6: { pts:7,  fg2m:2,  fg2a:5,  fg3m:1, fg3a:2,  ftm:0, fta:0 },
      77: { pts:5,  fg2m:1,  fg2a:6,  fg3m:1, fg3a:5,  ftm:0, fta:0 },
       8: { pts:4,  fg2m:1,  fg2a:5,  fg3m:0, fg3a:4,  ftm:2, fta:4 },
       9: { pts:3,  fg2m:1,  fg2a:4,  fg3m:0, fg3a:1,  ftm:1, fta:3 },
      10: { pts:2,  fg2m:1,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
       5: { pts:1,  fg2m:0,  fg2a:3,  fg3m:0, fg3a:0,  ftm:1, fta:2 },
    },
  },
  // ── unknown opp, AK 62 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/CCD6CB23-253D-49C0-A990-6F351F4672DF",
    akScore: 62,
    players: {
       8: { pts:21, fg2m:7,  fg2a:11, fg3m:1, fg3a:3,  ftm:4, fta:8 },
       3: { pts:11, fg2m:1,  fg2a:2,  fg3m:3, fg3a:7,  ftm:0, fta:0 },
      11: { pts:10, fg2m:5,  fg2a:11, fg3m:0, fg3a:1,  ftm:0, fta:1 },
      14: { pts:9,  fg2m:3,  fg2a:4,  fg3m:0, fg3a:0,  ftm:3, fta:4 },
      26: { pts:5,  fg2m:1,  fg2a:2,  fg3m:1, fg3a:1,  ftm:0, fta:0 },
       5: { pts:2,  fg2m:1,  fg2a:2,  fg3m:0, fg3a:0,  ftm:0, fta:2 },
       9: { pts:2,  fg2m:1,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
       0: { pts:2,  fg2m:1,  fg2a:2,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
    },
  },
  // ── unknown opp, AK 60 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/AF6D9011-E2D8-4CD7-9FC4-BCADFC7FC2D5",
    akScore: 60,
    players: {
      14: { pts:15, fg2m:6,  fg2a:8,  fg3m:0, fg3a:1,  ftm:3, fta:8 },
      77: { pts:14, fg2m:1,  fg2a:4,  fg3m:4, fg3a:11, ftm:0, fta:2 },
       3: { pts:9,  fg2m:3,  fg2a:5,  fg3m:1, fg3a:4,  ftm:0, fta:0 },
      11: { pts:9,  fg2m:4,  fg2a:8,  fg3m:0, fg3a:2,  ftm:1, fta:4 },
      19: { pts:5,  fg2m:2,  fg2a:6,  fg3m:0, fg3a:0,  ftm:1, fta:2 },
      26: { pts:3,  fg2m:0,  fg2a:1,  fg3m:1, fg3a:2,  ftm:0, fta:0 },
       0: { pts:2,  fg2m:1,  fg2a:5,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
       5: { pts:2,  fg2m:1,  fg2a:4,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
      10: { pts:1,  fg2m:0,  fg2a:1,  fg3m:0, fg3a:0,  ftm:1, fta:2 },
    },
  },
  // ── unknown opp, AK 37 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/4657DC11-3979-4832-995F-3DBA75E0B483",
    akScore: 37,
    players: {
      19: { pts:9,  fg2m:3,  fg2a:5,  fg3m:1, fg3a:1,  ftm:0, fta:0 },
      14: { pts:7,  fg2m:3,  fg2a:6,  fg3m:0, fg3a:4,  ftm:1, fta:2 },
       6: { pts:6,  fg2m:3,  fg2a:9,  fg3m:0, fg3a:8,  ftm:0, fta:0 },
       5: { pts:6,  fg2m:3,  fg2a:4,  fg3m:0, fg3a:0,  ftm:0, fta:2 },
       3: { pts:5,  fg2m:1,  fg2a:2,  fg3m:1, fg3a:6,  ftm:0, fta:0 },
      11: { pts:4,  fg2m:1,  fg2a:7,  fg3m:0, fg3a:3,  ftm:2, fta:2 },
    },
  },
  // ── unknown opp, AK 61 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/67967F00-FF8D-4033-99C3-D344ACC2F71E",
    akScore: 61,
    players: {
      14: { pts:17, fg2m:7,  fg2a:14, fg3m:1, fg3a:2,  ftm:0, fta:0 },
       8: { pts:12, fg2m:6,  fg2a:16, fg3m:0, fg3a:4,  ftm:0, fta:1 },
      77: { pts:11, fg2m:4,  fg2a:5,  fg3m:1, fg3a:3,  ftm:0, fta:0 },
       6: { pts:11, fg2m:4,  fg2a:8,  fg3m:1, fg3a:2,  ftm:0, fta:1 },
      11: { pts:5,  fg2m:1,  fg2a:12, fg3m:0, fg3a:0,  ftm:3, fta:6 },
       3: { pts:5,  fg2m:1,  fg2a:2,  fg3m:1, fg3a:7,  ftm:0, fta:0 },
    },
  },
  // ── unknown opp, AK 55 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/A11D9E71-4424-4194-A07E-D97EA82DB070",
    akScore: 55,
    players: {
       8: { pts:25, fg2m:10, fg2a:22, fg3m:1, fg3a:9,  ftm:2, fta:2 },
      10: { pts:8,  fg2m:4,  fg2a:7,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
       6: { pts:7,  fg2m:1,  fg2a:13, fg3m:1, fg3a:9,  ftm:2, fta:4 },
      77: { pts:7,  fg2m:2,  fg2a:6,  fg3m:1, fg3a:9,  ftm:0, fta:0 },
      26: { pts:5,  fg2m:1,  fg2a:7,  fg3m:1, fg3a:5,  ftm:0, fta:0 },
       9: { pts:3,  fg2m:0,  fg2a:4,  fg3m:1, fg3a:1,  ftm:0, fta:0 },
    },
  },
  // ── unknown opp, AK 38 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/8245BBF0-C33D-4179-AEA0-D87EC9999F88",
    akScore: 38,
    players: {
       6: { pts:7,  fg2m:2,  fg2a:6,  fg3m:0, fg3a:2,  ftm:3, fta:6 },
      26: { pts:7,  fg2m:2,  fg2a:3,  fg3m:1, fg3a:4,  ftm:0, fta:0 },
      14: { pts:6,  fg2m:3,  fg2a:10, fg3m:0, fg3a:3,  ftm:0, fta:2 },
      77: { pts:5,  fg2m:1,  fg2a:2,  fg3m:1, fg3a:6,  ftm:0, fta:0 },
      11: { pts:4,  fg2m:2,  fg2a:5,  fg3m:0, fg3a:0,  ftm:0, fta:2 },
       3: { pts:3,  fg2m:0,  fg2a:2,  fg3m:1, fg3a:6,  ftm:0, fta:0 },
      23: { pts:3,  fg2m:0,  fg2a:1,  fg3m:1, fg3a:3,  ftm:0, fta:0 },
      10: { pts:2,  fg2m:1,  fg2a:4,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
       9: { pts:1,  fg2m:0,  fg2a:4,  fg3m:0, fg3a:1,  ftm:1, fta:2 },
    },
  },
  // ── unknown opp, AK 43 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/AF3ADE32-8EDE-4CE9-8E79-17D0F582171D",
    akScore: 43,
    players: {
      11: { pts:20, fg2m:7,  fg2a:19, fg3m:1, fg3a:6,  ftm:3, fta:10 },
       3: { pts:11, fg2m:4,  fg2a:9,  fg3m:1, fg3a:8,  ftm:0, fta:0  },
      10: { pts:8,  fg2m:4,  fg2a:12, fg3m:0, fg3a:1,  ftm:0, fta:2  },
       5: { pts:4,  fg2m:2,  fg2a:7,  fg3m:0, fg3a:0,  ftm:0, fta:1  },
    },
  },
  // ── unknown opp, AK 42 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/B695ADE0-8A8D-4F69-9402-A83BAE094E28",
    akScore: 42,
    players: {
      11: { pts:9,  fg2m:4,  fg2a:8,  fg3m:0, fg3a:0,  ftm:1, fta:2 },
      14: { pts:8,  fg2m:3,  fg2a:7,  fg3m:0, fg3a:2,  ftm:2, fta:2 },
       6: { pts:8,  fg2m:3,  fg2a:8,  fg3m:0, fg3a:5,  ftm:2, fta:5 },
       9: { pts:6,  fg2m:3,  fg2a:10, fg3m:0, fg3a:3,  ftm:0, fta:2 },
      23: { pts:5,  fg2m:1,  fg2a:1,  fg3m:1, fg3a:5,  ftm:0, fta:0 },
       0: { pts:4,  fg2m:2,  fg2a:6,  fg3m:0, fg3a:1,  ftm:0, fta:0 },
      26: { pts:2,  fg2m:1,  fg2a:2,  fg3m:0, fg3a:1,  ftm:0, fta:0 },
    },
  },
  // ── unknown opp, AK 40 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/09243D8A-532B-41A0-8853-790893926326",
    akScore: 40,
    players: {
       8: { pts:16, fg2m:5,  fg2a:13, fg3m:1, fg3a:3,  ftm:3, fta:5 },
       9: { pts:6,  fg2m:3,  fg2a:8,  fg3m:0, fg3a:5,  ftm:0, fta:0 },
       3: { pts:5,  fg2m:1,  fg2a:1,  fg3m:1, fg3a:6,  ftm:0, fta:0 },
      11: { pts:4,  fg2m:2,  fg2a:11, fg3m:0, fg3a:2,  ftm:0, fta:0 },
      14: { pts:4,  fg2m:2,  fg2a:5,  fg3m:0, fg3a:1,  ftm:0, fta:0 },
      77: { pts:3,  fg2m:0,  fg2a:4,  fg3m:1, fg3a:8,  ftm:0, fta:2 },
       0: { pts:2,  fg2m:1,  fg2a:2,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
    },
  },
  // ── unknown opp, AK 64 (/men/) ───────────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/men/gamedetails/id/8E4A100C-FEE9-46A3-AF2B-D294FDE09B58",
    akScore: 64,
    players: {
       8: { pts:15, fg2m:4,  fg2a:8,  fg3m:2, fg3a:2,  ftm:1, fta:2 },
      11: { pts:12, fg2m:6,  fg2a:9,  fg3m:0, fg3a:1,  ftm:0, fta:2 },
      14: { pts:10, fg2m:5,  fg2a:9,  fg3m:0, fg3a:0,  ftm:0, fta:1 },
       9: { pts:9,  fg2m:3,  fg2a:7,  fg3m:1, fg3a:3,  ftm:0, fta:0 },
       3: { pts:5,  fg2m:1,  fg2a:3,  fg3m:1, fg3a:3,  ftm:0, fta:0 },
      77: { pts:5,  fg2m:1,  fg2a:1,  fg3m:1, fg3a:4,  ftm:0, fta:0 },
      10: { pts:5,  fg2m:2,  fg2a:3,  fg3m:0, fg3a:0,  ftm:1, fta:3 },
       6: { pts:3,  fg2m:0,  fg2a:3,  fg3m:1, fg3a:2,  ftm:0, fta:2 },
    },
  },
  // ── unknown opp, AK 61 (/winter-cup/) ────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/winter-cup/gamedetails/id/B3CEB59D-274C-4A3F-A4BB-C5AE2CB372AB",
    akScore: 61,
    players: {
       8: { pts:12, fg2m:6,  fg2a:12, fg3m:0, fg3a:0,  ftm:0, fta:0 },
       6: { pts:12, fg2m:6,  fg2a:13, fg3m:0, fg3a:1,  ftm:0, fta:0 },
      14: { pts:10, fg2m:5,  fg2a:9,  fg3m:0, fg3a:1,  ftm:0, fta:0 },
      11: { pts:9,  fg2m:4,  fg2a:10, fg3m:0, fg3a:0,  ftm:1, fta:1 },
      77: { pts:8,  fg2m:1,  fg2a:1,  fg3m:2, fg3a:7,  ftm:0, fta:0 },
      19: { pts:6,  fg2m:3,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
       9: { pts:4,  fg2m:2,  fg2a:5,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
    },
  },
  // ── unknown opp, AK 43 (/winter-cup/) ────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/winter-cup/gamedetails/id/EA7FC4E5-0044-4486-B27A-6AFFD73879C6",
    akScore: 43,
    players: {
       6: { pts:13, fg2m:5,  fg2a:11, fg3m:1, fg3a:6,  ftm:0, fta:2 },
      14: { pts:8,  fg2m:2,  fg2a:9,  fg3m:1, fg3a:3,  ftm:1, fta:4 },
       3: { pts:7,  fg2m:2,  fg2a:2,  fg3m:1, fg3a:5,  ftm:0, fta:0 },
      77: { pts:6,  fg2m:3,  fg2a:3,  fg3m:0, fg3a:7,  ftm:0, fta:0 },
      26: { pts:5,  fg2m:1,  fg2a:2,  fg3m:1, fg3a:3,  ftm:0, fta:0 },
      19: { pts:2,  fg2m:1,  fg2a:2,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
       9: { pts:2,  fg2m:0,  fg2a:4,  fg3m:0, fg3a:3,  ftm:2, fta:2 },
    },
  },
  // ── unknown opp, AK 34 (/winter-cup/) ────────────────────────────────────
  { url: "https://basketcity.sportstats.gr/winter-cup/gamedetails/id/C37F9FBB-5832-4A0F-A19E-F9ADD910E735",
    akScore: 34,
    players: {
       6: { pts:9,  fg2m:3,  fg2a:11, fg3m:1, fg3a:2,  ftm:0, fta:0 },
      77: { pts:8,  fg2m:1,  fg2a:3,  fg3m:2, fg3a:7,  ftm:0, fta:0 },
      11: { pts:7,  fg2m:3,  fg2a:7,  fg3m:0, fg3a:1,  ftm:1, fta:4 },
       5: { pts:2,  fg2m:1,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
      23: { pts:2,  fg2m:1,  fg2a:3,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
      26: { pts:2,  fg2m:1,  fg2a:2,  fg3m:0, fg3a:1,  ftm:0, fta:0 },
      19: { pts:2,  fg2m:1,  fg2a:7,  fg3m:0, fg3a:0,  ftm:0, fta:0 },
       9: { pts:2,  fg2m:1,  fg2a:3,  fg3m:0, fg3a:4,  ftm:0, fta:2 },
    },
  },
];

// ─── Pre-fetch all URLs once in parallel ─────────────────────────────────────

const scraped: Record<string, any> = {};

beforeAll(async () => {
  const results = await Promise.allSettled(
    GAMES.map(async g => {
      scraped[g.url] = await fetchAndScrape(g.url);
    })
  );
  const failed = results.filter(r => r.status === "rejected");
  if (failed.length) {
    console.warn(`${failed.length} URL(s) failed to fetch`);
  }
}, 90_000);

// ─── Per-game tests ───────────────────────────────────────────────────────────

for (const game of GAMES) {
  const id = game.url.split("/").pop()!.slice(0, 8);

  describe(`${id} (AK ${game.akScore})`, () => {
    it("AK score present in finalScore", () => {
      const data = scraped[game.url];
      expect(data, `no data for ${game.url}`).toBeDefined();
      const fs = data.game.finalScore;
      expect(
        [Number(fs.home), Number(fs.away)],
        `finalScore ${fs.home}-${fs.away} does not contain AK score ${game.akScore}`
      ).toContain(game.akScore);
    });

    it("quarter sums equal final score (per-quarter table selected)", () => {
      const data = scraped[game.url];
      expect(data).toBeDefined();
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

    it("player stats match DB snapshot", () => {
      const data = scraped[game.url];
      expect(data).toBeDefined();
      const players = akTeamPlayers(data);
      const byNum: Record<number, any> = Object.fromEntries(
        players.map((p: any) => [p["#"], p])
      );

      for (const [numStr, snap] of Object.entries(game.players)) {
        const num = Number(numStr);
        const p = Reflect.get(byNum, num);
        if (!p || parseMinutes(p.MIN) === 0) continue;
        expect(p.PTS,              `#${num} pts`).toBe(snap.pts);
        expect(p["2PTS"]?.made,    `#${num} fg2m`).toBe(snap.fg2m);
        expect(p["2PTS"]?.attempted, `#${num} fg2a`).toBe(snap.fg2a);
        expect(p["3PTS"]?.made,    `#${num} fg3m`).toBe(snap.fg3m);
        expect(p["3PTS"]?.attempted, `#${num} fg3a`).toBe(snap.fg3a);
        expect(p.FT?.made,         `#${num} ftm`).toBe(snap.ftm);
        expect(p.FT?.attempted,    `#${num} fta`).toBe(snap.fta);
      }
    });
  });
}
