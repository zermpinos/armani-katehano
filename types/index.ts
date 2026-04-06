/**
 * types/index.ts
 * Shared domain types for the app.
 * Prisma-generated types live in lib/generated/prisma -- import from there for DB shapes.
 * These are the app-layer types used in pages, components, and lib functions.
 */

// ─── Season / League ──────────────────────────────────────────────────────────

/** e.g. "2025-26" */
export type Season = string;

export type StatKey =
  | "pts" | "reb" | "ast" | "stl" | "blk" | "tov"
  | "fgm" | "fga" | "fg2m" | "fg2a" | "fg3m" | "fg3a"
  | "ftm" | "fta";

// ─── Player ───────────────────────────────────────────────────────────────────

/** Player bio as returned by repository queries (no stats). */
export interface PlayerBio {
  id: string;
  slug: string;
  name: string;
  number: number;
  position: string;
  height: string | null;
  weight: string | null;
  isActive: boolean;
  photoUrl: string | null;
}

// ─── Game ─────────────────────────────────────────────────────────────────────

/** Compact game row used in list views and the team record computation. */
export interface GameRow {
  id: string;
  date: string;           // ISO date string YYYY-MM-DD
  opponent: string;
  location: string | null;
  score: string;          // e.g. "72-58"
  result: "W" | "L";
  home: boolean;
  league: string;
  season: string;
  sourceUrl: string | null;
  youtubeUrl: string | null;
  notes: string | null;
}

// ─── Box score ────────────────────────────────────────────────────────────────

/** A single player's line in a game's box score. */
export interface BoxScoreRow {
  pid: string;
  min: number;
  pts: number;
  reb: number;
  orb: number;
  drb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  fgm: number;
  fga: number;
  fg2m: number;
  fg2a: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  eff: number;
}

/** Game with box score rows attached. */
export interface GameWithBoxScore extends GameRow {
  boxScore: BoxScoreRow[] | null;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/** A single entry in a player's game log. */
export interface GameLogEntry {
  gameId: string;
  date: string;
  opponent: string;
  league: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  eff: number;
  min: number;
  ftm: number;
  fta: number;
}

/** Per-player season stats as returned by buildStatsMap / aggregatesToStatsMap. */
export interface PlayerSeasonStats {
  ppg: number;
  rpg: number;
  orpg: number;
  drpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tpg: number;
  fpg: number;
  fgPct: number;
  fg2Pct: number;
  fg3Pct: number;
  ftPct: number | null;
  ftmPg: number;
  ftaPg: number;
  mpg: number;
  eff: number;
  tsPct?: number;
  gp: number;
  // Raw shot totals -- carried for cross-season aggregation
  fgm?: number;
  fga?: number;
  fg2m?: number;
  fg2a?: number;
  fg3m?: number;
  fg3a?: number;
  ftm?: number;
  fta?: number;
  gameLog: GameLogEntry[];
}

/** { [playerId]: PlayerSeasonStats } */
export type StatsMap = Record<string, PlayerSeasonStats>;

/** { [seasonName]: StatsMap } */
export type AllSeasonsStats = Record<string, StatsMap>;

// ─── Record ───────────────────────────────────────────────────────────────────

export interface TeamRecord {
  wins: number;
  losses: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  streak: { type: string; count: number };
  ppg: number;
  oppPpg: number;
  gp: number;
}
