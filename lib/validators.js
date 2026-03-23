// lib/validators.js
// Centralised Zod primitives shared across all API route schemas.
// Created to fix B-01: z.string().cuid() was removed in Zod v4.

import { z } from 'zod';

/**
 * CUID v1 validator.
 * Replaces z.string().cuid() which was removed in Zod v4.
 * Pattern: starts with 'c', followed by exactly 24 lowercase alphanumeric chars.
 */
export const zCuid = z.string().regex(/^c[a-z0-9]{24}$/, {
  message: 'Invalid CUID format',
});

/**
 * Optional CUID — for nullable foreign key fields.
 */
export const zCuidOptional = zCuid.optional();