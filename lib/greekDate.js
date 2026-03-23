// lib/greekDate.js
// Canonical Greek-language date parsing utilities.
//
// Single source of truth — imported by:
//   pages/api/admin/import.js      (backend API)
//   pages/admin/[slug]/import.js   (frontend admin page)
//   tests/import.test.js           (test suite)
//
// Previously these helpers were copy-pasted into all three files (Q-04).

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
   *   "5 Μαρτίου 2024"      → new Date(Date.UTC(2024, 2, 5))
   *   "15 Ιανουάριος 2025"  → new Date(Date.UTC(2025, 0, 15))
   *
   * Returns null for any unparseable input (null, empty, bad month, bad numbers).
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
    if (day < 1 || day > 31)                 return null;
    if (year < 2000 || year > 2100)          return null;
  
    // UTC prevents timezone-offset bugs when dates are later serialised to ISO strings
    return new Date(Date.UTC(year, month - 1, day));
  }
  
  /**
   * Normalises a raw league label into a consistent lowercase slug.
   *
   * "Rookie League" → "rookie"
   * "A1 Division"   → "a1"
   * "  PRO  "       → "pro"
   */
  export function detectLeagueSlug(raw) {
    if (!raw) return 'unknown';
    return raw.trim().toLowerCase().split(/\s+/)[0];
  }
  
  /**
   * Parses a minutes value that may be "MM:SS", a plain number, "DNP", or null.
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