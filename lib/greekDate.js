/**
 * lib/greekDate.js
 * Greek-language date parsing utilities.
 *
 * Single source of truth for GREEK_MONTHS, parseGreekDate, detectLeagueSlug,
 * and parseMinutes. Previously duplicated verbatim in:
 *   - pages/api/admin/import.js    (backend)
 *   - pages/admin/[slug]/import.js (frontend)
 *   - tests/import.test.js         (test file)
 *
 * Fixes: Q-04
 */

export const GREEK_MONTHS = {
  'Ιανουάριος': 1,  'Ιανουαρίου': 1,
  'Φεβρουάριος': 2, 'Φεβρουαρίου': 2,
  'Μάρτιος': 3,     'Μαρτίου': 3,
  'Απρίλιος': 4,    'Απριλίου': 4,
  'Μάιος': 5,       'Μαΐου': 5,
  'Ιούνιος': 6,     'Ιουνίου': 6,
  'Ιούλιος': 7,     'Ιουλίου': 7,
  'Αύγουστος': 8,   'Αυγούστου': 8,
  'Σεπτέμβριος': 9, 'Σεπτεμβρίου': 9,
  'Οκτώβριος': 10,  'Οκτωβρίου': 10,
  'Νοέμβριος': 11,  'Νοεμβρίου': 11,
  'Δεκέμβριος': 12, 'Δεκεμβρίου': 12,
};

/**
 * Parses a Greek-format date string into a JS Date (UTC midnight).
 *
 * Accepts:
 *   "5 Μαρτίου 2024"      → Date(2024, 2, 5)
 *   "15 Ιανουάριος 2025"  → Date(2025, 0, 15)
 *
 * Returns null for any input that cannot be parsed, including:
 *   - null / undefined / empty string
 *   - unrecognised month names
 *   - out-of-range day/year values
 */
export function parseGreekDate(str) {
  if (!str) return null;

  const parts = str.trim().split(/\s+/);
  if (parts.length < 3) return null;

  const [dayStr, monthStr, yearStr] = parts;
  const day   = parseInt(dayStr, 10);
  const month = GREEK_MONTHS[monthStr];
  const year  = parseInt(yearStr, 10);

  if (!month || isNaN(day) || isNaN(year)) return null;
  if (day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;

  // Use UTC to prevent timezone-offset bugs when dates are later serialised
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Extracts a league slug from a source URL.
 *
 * Looks for known league keyword segments in the URL path.
 * Falls back to null if nothing matches — callers should then
 * fall back to the most-recent SeasonLeague.
 *
 * Examples:
 *   "https://www.basket.gr/rookie-league/game/12345" → "rookie"
 *   "https://www.basket.gr/bc6/game/12345"           → "bc6"
 *   "https://www.basket.gr/wintercup/game/12345"     → "wintercup"
 */
export function detectLeagueSlug(url) {
  if (!url) return null;
  const known = ['rookie', 'bc6', 'wintercup'];
  const lower = url.toLowerCase();
  return known.find(slug => lower.includes(slug)) ?? null;
}

/**
 * Parses a minutes string that may be in "MM:SS" or plain numeric format.
 *
 * "32:14" → 32
 * "28"    → 28
 * "DNP"   → 0
 * null    → 0
 */
export function parseMinutes(raw) {
  if (!raw) return 0;
  const s = String(raw).trim();
  if (s.toUpperCase() === 'DNP') return 0;
  if (s.includes(':')) return parseInt(s.split(':')[0], 10);
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}