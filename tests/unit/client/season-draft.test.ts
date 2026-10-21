import { describe, it, expect } from "vitest";
import {
  toSeasonDraft, datesChanged, rosterChanged, enrolledBySeason,
  validateNewSeason, validateLeague, emptyLeague, EMPTY_SEASON,
} from "@/client/admin/seasons/season-draft";

const season = { id: "s1", name: "2026-27", year: 2026, startDate: "2026-09-01", endDate: "2027-06-30" };

describe("season draft", () => {
  it("copies the dates and the roster, without sharing the roster set", () => {
    const enrolled = new Set(["a", "b"]);
    const draft = toSeasonDraft(season, enrolled);
    expect(draft).toMatchObject({ start: "2026-09-01", end: "2027-06-30" });
    expect([...draft.playerIds]).toEqual(["a", "b"]);
    expect(draft.playerIds).not.toBe(enrolled);
  });

  it("notices a date change", () => {
    const draft = toSeasonDraft(season, new Set());
    expect(datesChanged(season, draft)).toBe(false);
    expect(datesChanged(season, { ...draft, end: "2027-07-15" })).toBe(true);
    expect(datesChanged({ ...season, startDate: undefined }, { ...draft, start: "" })).toBe(false);
  });

  it("notices a player added or removed, not a reordered set", () => {
    const enrolled = new Set(["a", "b"]);
    const draft = toSeasonDraft(season, enrolled);
    expect(rosterChanged(enrolled, { ...draft, playerIds: new Set(["b", "a"]) })).toBe(false);
    expect(rosterChanged(enrolled, { ...draft, playerIds: new Set(["a"]) })).toBe(true);
    expect(rosterChanged(enrolled, { ...draft, playerIds: new Set(["a", "c"]) })).toBe(true);
  });

  it("groups roster entries by season", () => {
    const map = enrolledBySeason([
      { seasonId: "s1", playerId: "a" }, { seasonId: "s1", playerId: "b" }, { seasonId: "s2", playerId: "a" },
    ]);
    expect([...(map.get("s1") ?? [])]).toEqual(["a", "b"]);
    expect([...(map.get("s2") ?? [])]).toEqual(["a"]);
  });

  it("asks for what the server needs", () => {
    expect(validateNewSeason(EMPTY_SEASON)).toBe("Name and year are required");
    expect(validateNewSeason({ name: "2027-28", year: "2027" })).toBeNull();
    expect(validateLeague(emptyLeague("s1"))).toBe("League name is required");
    expect(validateLeague({ ...emptyLeague("s1"), name: "BC6" })).toBeNull();
    expect(emptyLeague("s1")).toMatchObject({ organization: "basketcity", seasonId: "s1" });
  });
});
