import type { Season } from "@/client/admin/shared";

export type SeasonDraft    = { start: string; end: string; playerIds: ReadonlySet<string> };
export type NewSeasonDraft = { name: string; year: string };
export type LeagueDraft    = {
  name: string; organization: string; sourceSlug: string; listingUrl: string;
  organizer: string; level: string; seasonId: string;
};

export const EMPTY_SEASON: NewSeasonDraft = { name: "", year: "" };

export function emptyLeague(seasonId: string): LeagueDraft {
  return { name: "", organization: "basketcity", sourceSlug: "", listingUrl: "", organizer: "", level: "", seasonId };
}

export function toSeasonDraft(season: Season, enrolled: ReadonlySet<string>): SeasonDraft {
  return { start: season.startDate ?? "", end: season.endDate ?? "", playerIds: new Set(enrolled) };
}

export function datesChanged(season: Season, draft: SeasonDraft): boolean {
  return draft.start !== (season.startDate ?? "") || draft.end !== (season.endDate ?? "");
}

export function rosterChanged(enrolled: ReadonlySet<string>, draft: SeasonDraft): boolean {
  return enrolled.size !== draft.playerIds.size || [...enrolled].some(id => !draft.playerIds.has(id));
}

export function enrolledBySeason(entries: ReadonlyArray<{ seasonId: string; playerId: string }>): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const e of entries) {
    const set = map.get(e.seasonId) ?? new Set<string>();
    set.add(e.playerId);
    map.set(e.seasonId, set);
  }
  return map;
}

export function validateNewSeason(d: NewSeasonDraft): string | null {
  return d.name.trim() && d.year.trim() ? null : "Name and year are required";
}

export function validateLeague(d: LeagueDraft): string | null {
  return d.name.trim() ? null : "League name is required";
}
