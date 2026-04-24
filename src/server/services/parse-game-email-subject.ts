const AK_IDENTIFIERS = ["ARMANI", "KATEHANO"];

export interface ParsedSubject {
  home:      string;
  away:      string;
  dateStr:   string; // YYYY-MM-DD
  opponent:  string;
  akSide:    "home" | "away";
}

// Uppercase + strip diacritics for loose comparison
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

const STRICT_RE = /^(.+?)\s*[----]\s*(.+?)\s*\((\d{4}\/\d{2}\/\d{2})\)\s*$/;
const LOOSE_RE  = /^(.+?)\s*[----\/|:]\s*(.+?)\s*\((\d{4}\/\d{2}\/\d{2})\)\s*$/;

function extractParts(subject: string): { home: string; away: string; dateStr: string } | null {
  const m = STRICT_RE.exec(subject);
  if (m) return { home: m[1].trim(), away: m[2].trim(), dateStr: m[3].replace(/\//g, "-") };
  return null;
}

function extractPartsFuzzy(subject: string): { home: string; away: string; dateStr: string } | null {
  // Strip diacritics and retry with both patterns
  const norm = subject.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const m = STRICT_RE.exec(norm) ?? LOOSE_RE.exec(norm);
  if (m) return { home: m[1].trim(), away: m[2].trim(), dateStr: m[3].replace(/\//g, "-") };
  return null;
}

export function parseSubject(subject: string): ParsedSubject | null {
  const parts = extractParts(subject) ?? extractPartsFuzzy(subject);
  if (!parts) return null;

  const { home, away, dateStr } = parts;
  const normHome = normalize(home);
  const normAway = normalize(away);

  const akIsHome = AK_IDENTIFIERS.some(id => normHome.includes(id));
  const akIsAway = AK_IDENTIFIERS.some(id => normAway.includes(id));

  if (!akIsHome && !akIsAway) return null;

  const akSide: "home" | "away" = akIsHome ? "home" : "away";
  const opponent = akIsHome ? away : home;

  return { home, away, dateStr, opponent, akSide };
}
