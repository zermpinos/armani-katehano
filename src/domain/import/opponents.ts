// The source publishes team names in caps, often in Greek; the site shows them
// the way a reader expects. No mechanical rule gets from "TAZ BOYS" to "Taz
// Boyz" or "S.H.A.W." to "Shaw", so the mapping is explicit and a name that is
// not in it is not guessed at.
//
// The pairs live in the OpponentAlias table rather than here, so a name can be
// added without a deploy. This module stays pure: the caller loads them.

export type OpponentAliases = ReadonlyMap<string, string>;

// Both sides of the lookup are normalised the same way, since the source pads
// names and varies their case.
export function aliasKey(s: string): string {
  return s.replace(/\s+/g, " ").trim().toUpperCase();
}

export function buildAliases(
  rows: readonly { scrapedName: string; displayName: string }[],
): OpponentAliases {
  return new Map(rows.map(r => [aliasKey(r.scrapedName), r.displayName]));
}

// null rather than the input, so a caller can tell a known name from a guess.
export function displayOpponent(
  scraped: string | null | undefined,
  aliases: OpponentAliases,
): string | null {
  if (!scraped) return null;
  return aliases.get(aliasKey(scraped)) ?? null;
}
