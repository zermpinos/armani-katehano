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

export function parseGreekDate(str: string | null | undefined): Date | null {
  if (!str) return null;

  // Match DD MonthName YYYY anywhere in the string - handles "Σάββατο, 28 Μαρτίου 2026" prefix
  const match = str.trim().match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
  if (!match) return null;

  const day   = parseInt(match[1], 10);
  const month = GREEK_MONTHS[match[2] as keyof typeof GREEK_MONTHS];
  const year  = parseInt(match[3], 10);

  if (!month || isNaN(day) || isNaN(year)) return null;
  if (day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;

  // Use UTC to prevent timezone-offset bugs when dates are later serialised
  return new Date(Date.UTC(year, month - 1, day));
}

export function detectLeagueSlug(url: string | null | undefined): string | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  // Path-based detection (current basketcity.sportstats.gr URL structure)
  if (lower.includes('/winter-cup/') || lower.includes('/master-winter-cup/')) return 'wintercup';
  if (lower.includes('/men/'))        return 'men';       // resolved by date at import time
  // Legacy slug-in-URL (backward compat)
  const known = ['rookie', 'bc6', 'wintercup'];
  return known.find(slug => lower.includes(slug)) ?? null;
}

export function parseMinutes(raw: unknown): number {
  if (!raw) return 0;
  const str = String(raw).trim();
  if (str.toUpperCase() === 'DNP') return 0;
  if (str.includes(':')) {
    const [m, sec] = str.split(':').map(Number);
    const result = m + sec / 60;
    return isNaN(result) ? 0 : +(result).toFixed(2);
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}
