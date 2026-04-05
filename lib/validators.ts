// lib/validators.js
// Centralised Zod primitives shared across all API route schemas.
//
// Exports:
//   BoxScoreRowSchema  — validates a single box score row going into the DB
//   ScrapedGameSchema  — validates the shape of scraper output before it enters the app

import { z } from 'zod';

/**
 * Shared box score row schema — used by both the games API and the import endpoint.
 * Centralised here so validation logic stays in sync.
 */
export const BoxScoreRowSchema = z.object({
  playerId:  z.string().cuid(),
  minutes:   z.coerce.number().min(0).max(60),
  pts:       z.coerce.number().int().min(0).max(200),
  reb:       z.coerce.number().int().min(0).max(100),
  orb:       z.coerce.number().int().min(0).max(50).default(0),
  drb:       z.coerce.number().int().min(0).max(50).default(0),
  ast:       z.coerce.number().int().min(0).max(100),
  stl:       z.coerce.number().int().min(0).max(50),
  blk:       z.coerce.number().int().min(0).max(50),
  tov:       z.coerce.number().int().min(0).max(50),
  pf:        z.coerce.number().int().min(0).max(6),
  fgm:       z.coerce.number().int().min(0).max(100),
  fga:       z.coerce.number().int().min(0).max(100),
  fg2m:      z.coerce.number().int().min(0).max(100),
  fg2a:      z.coerce.number().int().min(0).max(100),
  fg3m:      z.coerce.number().int().min(0).max(50),
  fg3a:      z.coerce.number().int().min(0).max(50),
  ftm:       z.coerce.number().int().min(0).max(50),
  fta:       z.coerce.number().int().min(0).max(50),
})
  .refine(r => r.fgm  <= r.fga,               { message: "fgm cannot exceed fga" })
  .refine(r => r.fg2m <= r.fg2a,              { message: "fg2m cannot exceed fg2a" })
  .refine(r => r.fg3m <= r.fg3a,              { message: "fg3m cannot exceed fg3a" })
  .refine(r => r.ftm  <= r.fta,               { message: "ftm cannot exceed fta" })
  .refine(r => r.fg2m + r.fg3m === r.fgm,     { message: "fg2m + fg3m must equal fgm" })
  .refine(r => r.fg3m <= r.fgm,               { message: "fg3m cannot exceed fgm" })
  .refine(r => r.orb  + r.drb <= r.reb + 1,   { message: "orb+drb cannot exceed reb" });

/**
 * Validates the shape of data returned by the box-score scraper before it enters
 * any application logic. Rejects early if the site changes its HTML format.
 *
 * This intentionally stays loose on optional stats (MIN, PTS, shot columns)
 * so the schema doesn't break on minor format variations — those are caught
 * later by BoxScoreRowSchema when the data reaches the DB layer.
 */
const ScrapedPlayerSchema = z.object({
  "#":     z.number().int().min(0).max(99),
  Players: z.string().min(1),
  MIN:     z.string().optional().nullable(),
  PTS:     z.number().optional().nullable(),
}).passthrough();

const ScrapedTeamSchema = z.object({
  name:    z.string().min(1),
  players: z.array(ScrapedPlayerSchema).max(20),
}).passthrough();

export const ScrapedGameSchema = z.object({
  url:  z.string().url(),
  game: z.object({
    homeTeam:   z.string().min(1),
    awayTeam:   z.string().min(1),
    finalScore: z.object({
      home: z.number().nullable(),
      away: z.number().nullable(),
    }),
    date: z.string().nullable().optional(),
  }).passthrough(),
  teams: z.array(ScrapedTeamSchema).min(1).max(4),
});
