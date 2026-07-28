export interface SeasonRosterInput {
  id: string;
  seasonHistory?: Record<string, unknown>;
}

// The Player table is org-wide and carries no season, so a listing that shows
// all of it puts every signing and every leaver under every season. Membership
// comes from the season's roster, with two deliberate escapes: a recorded stat
// line outranks the roster, and a season with no roster on file shows everyone
// rather than nobody.
export function playersForSeason<T extends SeasonRosterInput>(
  players: T[],
  rosterBySeason: Record<string, string[]> | null | undefined,
  season: string,
): T[] {
  if (season === "all-time") return players;

  const rosterIds = Reflect.get((rosterBySeason ?? {}) as object, season) as string[] | undefined;
  if (!rosterIds) return players;

  return players.filter(p =>
    rosterIds.includes(p.id) || Boolean(Reflect.get((p.seasonHistory ?? {}) as object, season)),
  );
}
