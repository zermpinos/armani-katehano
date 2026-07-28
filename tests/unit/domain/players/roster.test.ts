// @ts-nocheck
import { describe, it, expect } from "vitest";
import { playersForSeason } from "@/domain/players/roster";

const LEAVER  = { id: "p1", seasonHistory: { "2025-26": { gp: 14 } } };
const STAYER  = { id: "p2", seasonHistory: { "2025-26": { gp: 12 } } };
const SIGNING = { id: "p3", seasonHistory: {} };
const ALL     = [LEAVER, STAYER, SIGNING];

const ROSTERS = {
  "2025-26": ["p1", "p2"],
  "2026-27": ["p2", "p3"],
};

const ids = rows => rows.map(r => r.id);

describe("playersForSeason", () => {
  it("drops a signing who was not on that season's roster", () => {
    expect(ids(playersForSeason(ALL, ROSTERS, "2025-26"))).toEqual(["p1", "p2"]);
  });

  it("drops a leaver from the season after they left", () => {
    expect(ids(playersForSeason(ALL, ROSTERS, "2026-27"))).toEqual(["p2", "p3"]);
  });

  it("keeps everyone for all-time", () => {
    expect(ids(playersForSeason(ALL, ROSTERS, "all-time"))).toEqual(["p1", "p2", "p3"]);
  });

  // Roster data is newer than the stat lines, so a season imported before the
  // rosters were kept must not lose the players who actually appeared in it.
  it("keeps a player with a recorded game even when off the roster", () => {
    const rosters = { "2025-26": ["p2"] };
    expect(ids(playersForSeason(ALL, rosters, "2025-26"))).toEqual(["p1", "p2"]);
  });

  it("shows everyone when the season has no roster on file", () => {
    expect(ids(playersForSeason(ALL, ROSTERS, "2024-25"))).toEqual(["p1", "p2", "p3"]);
  });

  it("shows everyone when roster data is missing entirely", () => {
    expect(ids(playersForSeason(ALL, null, "2025-26"))).toEqual(["p1", "p2", "p3"]);
  });
});
