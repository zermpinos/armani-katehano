/**
 * lib/repository.js
 * The single source of truth for all Redis key names and I/O operations.
 *
 * Every Redis read and write in the entire application goes through this file.
 * No other file should import Redis directly or construct key strings.
 *
 * Key schema:
 *   ak:config                        → { currentSeason: "2025-26" }
 *   ak:seasons                       → string[]  e.g. ["2025-26", "2026-27"]
 *   ak:players                       → PlayerBio[]  (bio only — no stats, no gameLog)
 *   ak:season:{id}:games             → Game[]  (full objects incl. boxScore, date desc)
 *   ak:season:{id}:schedule          → ScheduleItem[]  (date asc)
 *   ak:season:{id}:stats             → { [pid]: SeasonStats }  (computed after each game save)
 */

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ─── Key builders ─────────────────────────────────────────────────────────────

const K = {
  config:           ()   => "ak:config",
  seasons:          ()   => "ak:seasons",
  players:          ()   => "ak:players",
  games:            (sid) => `ak:season:${sid}:games`,
  schedule:         (sid) => `ak:season:${sid}:schedule`,
  stats:            (sid) => `ak:season:${sid}:stats`,
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG = { currentSeason: "2025-26" };

export const DEFAULT_SEASONS = ["2025-26"];

export const DEFAULT_STATS = {};  // empty — no players have stats yet

/** Biographical defaults — no stats, no gameLog, no photoUrl */
export const DEFAULT_PLAYERS = [
  { id:"p1",  number:0,  name:"Alexandros Kougianos",      position:"PF/C",    height:"", weight:"", age:null },
  { id:"p2",  number:3,  name:"Stathis Christofilopoulos", position:"SG",      height:"", weight:"", age:null },
  { id:"p3",  number:5,  name:"Panagiotis Zermpinos",      position:"C",       height:"", weight:"", age:null },
  { id:"p4",  number:6,  name:"Nikos Tsiardakas",          position:"PG/SG",   height:"", weight:"", age:null },
  { id:"p5",  number:8,  name:"Spiros Papaspirou",         position:"PG",      height:"", weight:"", age:null },
  { id:"p6",  number:9,  name:"Dimitris Alevizos",         position:"SG",      height:"", weight:"", age:null },
  { id:"p7",  number:10, name:"Loukas Margaritis",         position:"C",       height:"", weight:"", age:null },
  { id:"p8",  number:11, name:"Giorgos Antonakos",         position:"PG",      height:"", weight:"", age:null },
  { id:"p9",  number:14, name:"Giorgos Tsioulkas",         position:"SF/PF",   height:"", weight:"", age:null },
  { id:"p10", number:19, name:"Panagiotis Antonakos",      position:"PG/SG/SF",height:"", weight:"", age:null },
  { id:"p11", number:23, name:"Konstantinos Psillas",      position:"PG/SG",   height:"", weight:"", age:null },
  { id:"p12", number:26, name:"Tolis Michalopoulos",       position:"SG/SF",   height:"", weight:"", age:null },
  { id:"p13", number:77, name:"Andreas Papadimitriou",     position:"PG/SG",   height:"", weight:"", age:null },
];

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getConfig() {
  return (await redis.get(K.config())) ?? DEFAULT_CONFIG;
}
export async function setConfig(v) {
  await redis.set(K.config(), v);
}

// ─── Seasons ──────────────────────────────────────────────────────────────────

export async function getSeasons() {
  return (await redis.get(K.seasons())) ?? DEFAULT_SEASONS;
}
export async function setSeasons(v) {
  await redis.set(K.seasons(), v);
}

/** Adds a season id to the list if not already present. */
export async function addSeason(seasonId) {
  const seasons = await getSeasons();
  if (seasons.includes(seasonId)) return seasons;
  const updated = [...seasons, seasonId].sort();
  await setSeasons(updated);
  return updated;
}

// ─── Players (biographical — season-independent) ──────────────────────────────

export async function getPlayers() {
  return (await redis.get(K.players())) ?? DEFAULT_PLAYERS;
}
export async function setPlayers(v) {
  await redis.set(K.players(), v);
}

// ─── Games (season-scoped) ────────────────────────────────────────────────────

export async function getGames(seasonId) {
  return (await redis.get(K.games(seasonId))) ?? [];
}
export async function setGames(seasonId, v) {
  await redis.set(K.games(seasonId), v);
}

// ─── Schedule (season-scoped) ─────────────────────────────────────────────────

export async function getSchedule(seasonId) {
  return (await redis.get(K.schedule(seasonId))) ?? [];
}
export async function setSchedule(seasonId, v) {
  await redis.set(K.schedule(seasonId), v);
}

// ─── Stats (season-scoped, computed) ──────────────────────────────────────────

/**
 * Returns the pre-computed stats map for a season.
 * Shape: { [pid]: { ppg, rpg, orpg, drpg, apg, spg, bpg, tpg, fpg,
 *                   fgPct, fg2Pct, fg3Pct, ftPct, mpg, eff, gp, gameLog } }
 */
export async function getStats(seasonId) {
  return (await redis.get(K.stats(seasonId))) ?? DEFAULT_STATS;
}
export async function setStats(seasonId, v) {
  await redis.set(K.stats(seasonId), v);
}

// ─── Batch read helpers ───────────────────────────────────────────────────────

/**
 * Fetches everything needed for a specific season in one parallel batch.
 * Used by getServerSideProps on public pages.
 */
export async function getSeasonData(seasonId) {
  const [games, schedule, stats] = await Promise.all([
    getGames(seasonId),
    getSchedule(seasonId),
    getStats(seasonId),
  ]);
  return { games, schedule, stats };
}

/**
 * Fetches all data needed to bootstrap any public page.
 * Returns players (bio), config, seasons list, and data for the requested season.
 */
export async function getAllPublicData(seasonId = null) {
  const [config, seasons, players] = await Promise.all([
    getConfig(),
    getSeasons(),
    getPlayers(),
  ]);

  const activeSeason = seasonId ?? config.currentSeason;
  const { games, schedule, stats } = await getSeasonData(activeSeason);

  return {
    config,
    seasons,
    currentSeason: activeSeason,
    players,
    games,
    schedule,
    stats,
  };
}

/**
 * Fetches stats for ALL seasons in parallel.
 * Used for all-time leaderboard aggregation.
 */
export async function getAllSeasonsStats(seasons) {
  const results = await Promise.all(seasons.map(sid => getStats(sid)));
  return Object.fromEntries(seasons.map((sid, i) => [sid, results[i]]));
}
