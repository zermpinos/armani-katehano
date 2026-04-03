/**
 * lib/positions.js
 * Single source of truth for valid player position values.
 * Imported by the Zod schema (API validation) and the UI dropdown (roster page).
 */

export const POSITIONS = [
  "PG", "SG", "SF", "PF", "C",
  "PG/SG", "PG/SF", "SG/SF", "SF/PF", "PF/C",
];
