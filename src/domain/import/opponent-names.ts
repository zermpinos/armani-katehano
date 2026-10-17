import { aliasKey, type OpponentAliases } from "./opponents";

export interface WaitingName {
  scrapedName: string;
  suggestion:  string;
  waitingOn:   "fixture" | "result";
  dateText:    string | null;
}

type Unmapped = { scrapedName: string; suggestion: string; dateText?: string };

// The last poll run's record is the queue: every name it could not place, minus the ones named since.
export function waitingNames(summary: unknown, aliases: OpponentAliases): WaitingName[] {
  const s = (summary ?? {}) as { fixtures?: { unmapped?: Unmapped[] }; unknownOpponents?: Unmapped[] };
  const out = new Map<string, WaitingName>();
  const add = (u: Unmapped, waitingOn: WaitingName["waitingOn"]) => {
    const key = aliasKey(u.scrapedName);
    if (aliases.has(key) || out.has(key)) return;
    out.set(key, { scrapedName: u.scrapedName, suggestion: u.suggestion, waitingOn, dateText: u.dateText ?? null });
  };
  for (const u of s.fixtures?.unmapped ?? []) add(u, "fixture");
  for (const u of s.unknownOpponents ?? []) add(u, "result");
  return [...out.values()];
}

const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 4);

// A shared word finds the existing spelling of a team the league renamed; four letters keeps "the" and "bc" out.
export function similarNames(scraped: string, names: readonly string[], limit = 5): string[] {
  const mine = new Set(words(scraped));
  if (mine.size === 0) return [];
  return names.filter(n => words(n).some(w => mine.has(w))).slice(0, limit);
}
