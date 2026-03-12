/**
 * lib/data.js
 * All Vercel KV reads and writes go through this module.
 * The public site calls read-only helpers (no auth required).
 * The admin API calls write helpers (protected by requireAuth).
 *
 * Key schema:
 *   ak:team       -> { name, abbreviation, season }
 *   ak:record     -> legacy, kept for backward-compat but NOT used for display
 *   ak:players    -> Player[]  (sorted by jersey number)
 *   ak:games      -> Game[]    (sorted by date desc)  -- each game has optional `league: "rookie"|"bc6"|"wintercup"|""`
 *   ak:schedule   -> ScheduleItem[]  (sorted by date asc)
 */

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ─── Keys ────────────────────────────────────────────────────────────────────
const K = {
  team:     "ak:team",
  record:   "ak:record",
  players:  "ak:players",
  games:    "ak:games",
  schedule: "ak:schedule",
};

// ─── Defaults ────────────────────────────────────────────────────────────────
export const DEFAULT_TEAM = {
  name: "Armani Katehano",
  abbreviation: "AK",
  season: "2025-26",
};

export const DEFAULT_RECORD = {
  wins: 0, losses: 0,
  homeWins: 0, homeLosses: 0,
  awayWins: 0, awayLosses: 0,
  streak: { type: "W", count: 0 },
  pointsPerGame: 0,
  pointsAllowedPerGame: 0,
};

export const DEFAULT_PLAYERS = [
  { id:"p1",  number:0,  name:"Alexandros Kougianos",      position:"PF/C",    height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p2",  number:3,  name:"Stathis Christofilopoulos", position:"SG",      height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p3",  number:5,  name:"Webmaster",      position:"C",       height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p4",  number:6,  name:"Nikos Tsiardakas",          position:"PG/SG",   height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p5",  number:8,  name:"Spiros Papaspirou",         position:"PG",      height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p6",  number:9,  name:"Dimitris Alevizos",         position:"SG",      height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p7",  number:10, name:"Loukas Margaritis",         position:"C",       height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p8",  number:11, name:"Giorgos Antonakos",         position:"PG",      height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p9",  number:14, name:"Giorgos Tsioulkas",         position:"SF/PF",   height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p10", number:19, name:"Panagiotis Antonakos",      position:"PG/SG/SF",height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p11", number:23, name:"Konstantinos Psillas",      position:"PG/SG",   height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p12", number:26, name:"Tolis Michalopoulos",       position:"SG/SF",   height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p13", number:77, name:"Andreas Papadimitriou",     position:"PG/SG",   height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
];

// ─── Read helpers (public, no auth) ─────────────────────────────────────────

export async function getTeam()     { return (await redis.get(K.team))     ?? DEFAULT_TEAM;    }
export async function getRecord()   { return (await redis.get(K.record))   ?? DEFAULT_RECORD;  }
export async function getPlayers()  { return (await redis.get(K.players))  ?? DEFAULT_PLAYERS; }
export async function getGames()    { return (await redis.get(K.games))    ?? [];               }
export async function getSchedule() { return (await redis.get(K.schedule)) ?? [];               }

/** Fetch all public data in one round-trip batch */
export async function getAllPublicData() {
  const [team, record, players, games, schedule] = await Promise.all([
    getTeam(), getRecord(), getPlayers(), getGames(), getSchedule(),
  ]);
  return { team, record, players, games, schedule };
}

// ─── Write helpers (admin only -- call from protected API routes) ─────────────

export async function setTeam(v)     { await redis.set(K.team,     v); }
export async function setRecord(v)   { await redis.set(K.record,   v); }
export async function setPlayers(v)  { await redis.set(K.players,  v); }
export async function setGames(v)    { await redis.set(K.games,    v); }
export async function setSchedule(v) { await redis.set(K.schedule, v); }

// ─── computeRecord ────────────────────────────────────────────────────────────
/**
 * Computes the full record object from the games array.
 * Pass leagueFilter = "rookie" | "bc6" | "wintercup" to scope to one league,
 * or omit / pass null for all games combined.
 *
 * Returns:
 *   { wins, losses, homeWins, homeLosses, awayWins, awayLosses,
 *     streak: { type, count }, ppg, oppPpg, gp }
 */
export function computeRecord(games, leagueFilter = null) {
  const filtered = leagueFilter
    ? games.filter(g => (g.league || "") === leagueFilter)
    : games;

  const gp = filtered.length;
  if (gp === 0) {
    return {
      wins: 0, losses: 0,
      homeWins: 0, homeLosses: 0,
      awayWins: 0, awayLosses: 0,
      streak: { type: "W", count: 0 },
      ppg: 0, oppPpg: 0, gp: 0,
    };
  }

  let wins = 0, losses = 0;
  let homeWins = 0, homeLosses = 0;
  let awayWins = 0, awayLosses = 0;
  let totalPts = 0, totalOppPts = 0;

  for (const g of filtered) {
    const isW = g.result === "W";
    if (isW) wins++; else losses++;
    if (g.home) { if (isW) homeWins++; else homeLosses++; }
    else        { if (isW) awayWins++; else awayLosses++; }

    // Parse score "72-58" (en-dash or regular hyphen)
    const parts = (g.score || "").split(/[-\-]/);
    if (parts.length === 2) {
      totalPts    += parseInt(parts[0], 10) || 0;
      totalOppPts += parseInt(parts[1], 10) || 0;
    }
  }

  // Streak: walk games newest->oldest (games are stored date desc)
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
  const streakType = sorted[0].result;
  let streakCount = 0;
  for (const g of sorted) {
    if (g.result === streakType) streakCount++;
    else break;
  }

  return {
    wins, losses,
    homeWins, homeLosses,
    awayWins, awayLosses,
    streak: { type: streakType, count: streakCount },
    ppg:    gp > 0 ? +(totalPts    / gp).toFixed(1) : 0,
    oppPpg: gp > 0 ? +(totalOppPts / gp).toFixed(1) : 0,
    gp,
  };
}

// ─── Stats recalculation ──────────────────────────────────────────────────────

/**
 * Recalculates season averages for all players from the stored game logs.
 * Called by the admin after adding/editing a game.
 */
export function recalcPlayerAverages(players, games) {
  return players.map(player => {
    // Collect all box score rows for this player across all games
    const rows = games
      .filter(g => g.boxScore)
      .flatMap(g => g.boxScore.filter(r => r.pid === player.id && r.min > 0));

    if (rows.length === 0) return player;

    const n     = rows.length;
    const sum   = f => rows.reduce((acc, r) => acc + (r[f] || 0), 0);
    const avg   = f => +(sum(f) / n).toFixed(1);
    const pct   = (m, a) => { const t = sum(a); return t > 0 ? +(sum(m) / t * 100).toFixed(1) : 0; };

    // Build game log for charts (last 10 games)
    const gameLog = rows.slice(-10).map((r, i) => ({
      game: `G${i + 1}`,
      pts:  r.pts  || 0,
      reb:  r.reb  || 0,
      ast:  r.ast  || 0,
    }));

    return {
      ...player,
      stats: {
        ppg:    avg("pts"),
        rpg:    avg("reb"),
        apg:    avg("ast"),
        spg:    avg("stl"),
        bpg:    avg("blk"),
        tpg:    avg("tov"),
        fpg:    avg("pf"),
        fgPct:  pct("fgm", "fga"),
        fg3Pct: pct("fg3m", "fg3a"),
        ftPct:  pct("ftm", "fta"),
        mpg:    avg("min"),
        eff:    avg("eff"),
      },
      gameLog,
    };
  });
}

/**
 * Computes per-game efficiency from box score row.
 */
export function calcEff({ pts=0, reb=0, ast=0, stl=0, blk=0,
                           tov=0, fgm=0, fga=0, ftm=0, fta=0 }) {
  return Math.round(pts + reb + ast + stl + blk - (fga - fgm) - (fta - ftm) - tov);
}
