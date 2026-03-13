/**
 * lib/utils.js
 * Pure utility functions shared across all pages and API routes.
 * No imports from other project files — zero dependency risk.
 */

// ─── Name formatting ──────────────────────────────────────────────────────────

/**
 * Formats a player name for display.
 * "First Last"       → "Last F."
 * "Giorgos Antonakos"→ "Antonakos G."
 * "Panagiotis Antonakos" → "Antonakos P."  ← handles duplicate last names correctly
 * Single-word names are returned as-is.
 *
 * This is the canonical implementation. Do NOT copy-paste this into page files.
 * Import it: import { fmt } from "../lib/utils";
 */
export function fmt(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 1] + " " + parts[0][0].toUpperCase() + ".";
}

// ─── Score parsing ────────────────────────────────────────────────────────────

/**
 * Parses a score string into home/away integers.
 * Handles both en-dash ("72–58") and hyphen ("72-58").
 * Returns { ak: number, opp: number } or null if unparseable.
 *
 * The first number is always AK's score, second is opponent's.
 */
export function parseScore(scoreStr) {
  if (!scoreStr) return null;
  const parts = scoreStr.split(/[–\-]/);
  if (parts.length !== 2) return null;
  const ak  = parseInt(parts[0], 10);
  const opp = parseInt(parts[1], 10);
  if (isNaN(ak) || isNaN(opp)) return null;
  return { ak, opp };
}

// ─── Date formatting ──────────────────────────────────────────────────────────

/**
 * Formats an ISO date string (YYYY-MM-DD) for display.
 * "2025-09-27" → "27 Sep 2025"
 * Returns the original string unchanged if it can't be parsed,
 * so legacy DD/MM/YYYY dates still render rather than crashing.
 */
export function fmtDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr; // graceful fallback for legacy format
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
