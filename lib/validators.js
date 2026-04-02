// lib/validators.js
// Centralised Zod primitives shared across all API route schemas.
// Created to fix B-01: z.string().cuid() was removed in Zod v4.

import { z } from 'zod';

/**
 * CUID v1 validator.
 * Replaces z.string().cuid() which was removed in Zod v4.
 * Pattern: starts with 'c', followed by exactly 24 lowercase alphanumeric chars.
 */

export const zCuid = z.string().regex(/^c[a-z0-9]{20,30}$/, {
  message: 'Invalid CUID format',
});

/**
 * Optional CUID -- for nullable foreign key fields.
 */
export const zCuidOptional = zCuid.optional();

/**
 * Shared box score row schema -- used by both the games API and the import endpoint.
 * Centralised here so validation logic stays in sync.
 */
export const BoxScoreRowSchema = z.object({
  playerId:  zCuid,
  minutes:   z.coerce.number().int().min(0).max(60),
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