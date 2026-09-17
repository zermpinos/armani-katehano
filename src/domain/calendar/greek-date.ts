const GREEK_MONTHS = {
  'Ιανουάριος': 1,  'Ιανουαρίου': 1,
  'Φεβρουάριος': 2, 'Φεβρουαρίου': 2,
  'Μάρτιος': 3,     'Μαρτίου': 3,
  'Απρίλιος': 4,    'Απριλίου': 4,
  // The source site writes Μαίου, not the correct Μαΐου, so both are accepted.
  'Μάιος': 5,       'Μαΐου': 5,      'Μαίου': 5,
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

const ATHENS = "Europe/Athens";

// How far Athens wall-clock runs ahead of UTC at a given instant. Read from the
// zone rather than fixed at +3: Greece drops to +2 in late October, so a
// constant would move every winter fixture an hour off.
function athensOffsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instant));
  const n = (type: string) => Number(parts.find(p => p.type === type)?.value);
  // Midnight prints as 24 under some ICU builds, which would roll the day.
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute"), n("second")) - instant;
}

// The listing prints a local kick-off ("Σάββατο, 19 Σεπτεμβρίου 2026 / 16:15").
// Returns the instant that names, or null when either half is unreadable, so a
// caller can skip rather than invent a time.
export function parseGreekDateTime(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined,
): Date | null {
  const date = parseGreekDate(dateStr);
  if (!date) return null;

  const match = String(timeStr ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours   = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) return null;

  const wallClock = date.getTime() + (hours * 60 + minutes) * 60_000;
  // Twice: the first offset is sampled at the wrong instant for a reading that
  // sits near a transition, the second at the corrected one.
  const firstPass = wallClock - athensOffsetMs(wallClock);
  return new Date(wallClock - athensOffsetMs(firstPass));
}

export function detectLeagueSlug(url: string | null | undefined): string | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  // Matches /winter-cup/, /master-winter-cup/, /super-winter-cup/ and future -winter-cup/ variants.
  if (lower.includes('winter-cup/')) return 'wintercup';
  if (lower.includes('/men/'))       return 'men';
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
