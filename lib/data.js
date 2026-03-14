/**
 * lib/data.js
 * Redis I/O layer -- reads and writes only. No computation logic here.
 *
 * Pure stat functions live in lib/stats.js.
 * Pure utility functions live in lib/utils.js.
 *
 * Key schema:
 *   ak:team       -> { name, abbreviation, season }
 *   ak:record     -> legacy, kept for backward-compat but NOT used for display
 *   ak:players    -> Player[]  (sorted by jersey number)
 *   ak:games      -> Game[]    (sorted by date desc)
 *   ak:schedule   -> ScheduleItem[]
 */

import { Redis } from "@upstash/redis";

// Re-export pure functions so existing imports of lib/data keep working.
// e.g. import { computeRecord } from "../lib/data" still works everywhere.
export { computeRecord, recalcPlayerAverages, calcEff } from "./stats.js";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
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
  { id:"p1",  number:0,  name:"Alexandros Kougianos",      position:"PF/C",    height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p2",  number:3,  name:"Stathis Christofilopoulos", position:"SG",      height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p3",  number:5,  name:"Webmaster",      position:"C",       height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p4",  number:6,  name:"Nikos Tsiardakas",          position:"PG/SG",   height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p5",  number:8,  name:"Spiros Papaspirou",         position:"PG",      height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p6",  number:9,  name:"Dimitris Alevizos",         position:"SG",      height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p7",  number:10, name:"Loukas Margaritis",         position:"C",       height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p8",  number:11, name:"Giorgos Antonakos",         position:"PG",      height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p9",  number:14, name:"Giorgos Tsioulkas",         position:"SF/PF",   height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p10", number:19, name:"Panagiotis Antonakos",      position:"PG/SG/SF",height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p11", number:23, name:"Konstantinos Psillas",      position:"PG/SG",   height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p12", number:26, name:"Tolis Michalopoulos",       position:"SG/SF",   height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
  { id:"p13", number:77, name:"Andreas Papadimitriou",     position:"PG/SG",   height:"", weight:"", age:null, stats:{ ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] },
];

// ─── Read helpers (public, no auth) ──────────────────────────────────────────

export async function getTeam()     { return (await redis.get(K.team))     ?? DEFAULT_TEAM;    }
export async function getRecord()   { return (await redis.get(K.record))   ?? DEFAULT_RECORD;  }
export async function getPlayers()  { return (await redis.get(K.players))  ?? DEFAULT_PLAYERS; }
export async function getGames()    { return (await redis.get(K.games))    ?? [];               }
export async function getSchedule() { return (await redis.get(K.schedule)) ?? [];               }

/**
 * Fetches all public data in one parallel batch.
 * Used by every public page's getServerSideProps.
 */
export async function getAllPublicData() {
  const [team, record, players, games, schedule] = await Promise.all([
    getTeam(), getRecord(), getPlayers(), getGames(), getSchedule(),
  ]);
  return { team, record, players, games, schedule };
}

// ─── Write helpers (admin only -- call from protected API routes) ──────────────

export async function setTeam(v)     { await redis.set(K.team,     v); }
export async function setRecord(v)   { await redis.set(K.record,   v); }
export async function setPlayers(v)  { await redis.set(K.players,  v); }
export async function setGames(v)    { await redis.set(K.games,    v); }
export async function setSchedule(v) { await redis.set(K.schedule, v); }
