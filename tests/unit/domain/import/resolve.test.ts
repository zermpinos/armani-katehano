// @ts-nocheck
import { describe, it, expect } from "vitest";
import { resolve, diffDraft, toCommitInput } from "@/domain/import/resolve";

const roster = [
  { id: "p1", number: 4 },
  { id: "p2", number: 7 },
];

const ROOKIE = { id: "sl1", leagueSlug: "basketcity-rookie", organization: "basketcity", sourceSlug: "rookie", seasonStart: "2025-09-01T00:00:00.000Z", seasonEnd: null };

function scrapedData(akPlayers, url = "https://example.com/rookie/game/123") {
  return {
    game: {
      homeTeam: "ARMANI KATEHANO",
      awayTeam: "Rivals",
      date: "Σάββατο, 1 Ιανουαρίου 2026",
      finalScore: { home: 60, away: 55 },
    },
    teams: [
      { name: "ARMANI KATEHANO", players: akPlayers },
      { name: "Rivals", players: [] },
    ],
    url,
  };
}

const onRoster = { "#": 4, Players: "On Roster", MIN: "20:00", PTS: 10 };

describe("resolve roster guard", () => {
  it("flags a scraped player with minutes who is not on the roster", () => {
    const { unresolved, unresolvedPlayers } = resolve(
      scrapedData([onRoster, { "#": 99, Players: "New Guy", MIN: "15:00", PTS: 8 }]),
      roster,
      [ROOKIE],
    );
    // Number and name, not prose: the form offers to create the player.
    expect(unresolvedPlayers).toEqual([{ number: 99, name: "New Guy" }]);
    expect(unresolved).toHaveLength(0);
  });

  it("does not flag when every scraped player with minutes is on the roster", () => {
    const { unresolvedPlayers } = resolve(
      scrapedData([onRoster, { "#": 7, Players: "Also Roster", MIN: "18:00", PTS: 6 }]),
      roster,
      [ROOKIE],
    );
    expect(unresolvedPlayers).toHaveLength(0);
  });

  it("ignores a non-roster jersey that did not play", () => {
    const { unresolvedPlayers } = resolve(
      scrapedData([onRoster, { "#": 99, Players: "Bench", MIN: "0", PTS: 0 }]),
      roster,
      [ROOKIE],
    );
    expect(unresolvedPlayers).toHaveLength(0);
  });

  it("keeps a league blocker out of the roster list, since it is fixed in the form", () => {
    const { unresolved, unresolvedPlayers } = resolve(
      scrapedData([onRoster, { "#": 99, Players: "New Guy", MIN: "15:00", PTS: 8 }]),
      roster,
      [{ id: "slX", leagueSlug: "basketcity-bc6", organization: "basketcity", sourceSlug: "bc6", seasonStart: null, seasonEnd: null }],
    );
    expect(unresolvedPlayers).toHaveLength(1);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toContain("rookie");
  });

  it("zeroes a rostered player who did not appear in the scrape", () => {
    const { draft, highlights } = resolve(scrapedData([onRoster]), roster, [ROOKIE]);
    const absent = draft.boxScore.find(r => r.playerId === "p2");
    expect(absent.min).toBe(0);
    expect(absent.pts).toBe(0);
    expect(highlights.p2).toBeUndefined();
  });
});

describe("resolve league resolution", () => {
  it("leaves seasonLeagueId empty when no league matches, with no silent fallback", () => {
    const { draft, unresolved } = resolve(
      scrapedData([onRoster]),
      roster,
      [{ id: "slX", leagueSlug: "basketcity-bc6", organization: "basketcity", sourceSlug: "bc6", seasonStart: null, seasonEnd: null }],
    );
    expect(draft.seasonLeagueId).toBe("");
    expect(unresolved.join(" ")).toContain("rookie");
  });

  it("skips a season that ended before the game date", () => {
    const { draft, unresolved } = resolve(
      scrapedData([onRoster]),
      roster,
      [{ id: "slOld", leagueSlug: "basketcity-rookie", organization: "basketcity", sourceSlug: "rookie", seasonStart: "2024-09-01T00:00:00.000Z", seasonEnd: "2025-06-30T00:00:00.000Z" }],
    );
    expect(draft.seasonLeagueId).toBe("");
    expect(unresolved).toHaveLength(1);
  });

  it("skips a season that had not started on the game date", () => {
    const { draft, unresolved } = resolve(
      scrapedData([onRoster]),
      roster,
      [{ id: "slNext", leagueSlug: "basketcity-rookie", organization: "basketcity", sourceSlug: "rookie", seasonStart: "2026-09-01T00:00:00.000Z", seasonEnd: "2027-07-31T00:00:00.000Z" }],
    );
    expect(draft.seasonLeagueId).toBe("");
    expect(unresolved).toHaveLength(1);
  });

  // The same league runs every year, so a backfilled game matches more than one
  // season on the league alone. Without the start bound the newest-first sort
  // would file it under the season that had not begun yet.
  it("files an old game under the season that was running, not the newest", () => {
    const { draft } = resolve(scrapedData([onRoster]), roster, [
      { id: "slPast", leagueSlug: "basketcity-rookie", organization: "basketcity", sourceSlug: "rookie", seasonStart: "2025-09-01T00:00:00.000Z", seasonEnd: "2026-07-31T00:00:00.000Z" },
      { id: "slNext", leagueSlug: "basketcity-rookie", organization: "basketcity", sourceSlug: "rookie", seasonStart: "2026-09-01T00:00:00.000Z", seasonEnd: "2027-07-31T00:00:00.000Z" },
    ]);
    expect(draft.seasonLeagueId).toBe("slPast");
  });

  it("picks the most recent season when a league has several", () => {
    const { draft } = resolve(scrapedData([onRoster]), roster, [
      { id: "slOld", leagueSlug: "basketcity-rookie", organization: "basketcity", sourceSlug: "rookie", seasonStart: "2024-09-01T00:00:00.000Z", seasonEnd: null },
      { id: "slNew", leagueSlug: "basketcity-rookie", organization: "basketcity", sourceSlug: "rookie", seasonStart: "2025-09-01T00:00:00.000Z", seasonEnd: null },
    ]);
    expect(draft.seasonLeagueId).toBe("slNew");
  });

  it("resolves a /men/ URL to the single active non-winter league", () => {
    const { draft, unresolved } = resolve(
      scrapedData([onRoster], "https://example.com/men/game/99"),
      roster,
      [ROOKIE, { id: "slW", leagueSlug: "basketcity-wintercup", organization: "basketcity", sourceSlug: "wintercup", seasonStart: null, seasonEnd: null }],
    );
    expect(draft.seasonLeagueId).toBe("sl1");
    expect(unresolved).toHaveLength(0);
  });

  it("blocks a /men/ URL when several non-winter leagues are active", () => {
    const { draft, unresolved } = resolve(
      scrapedData([onRoster], "https://example.com/men/game/99"),
      roster,
      [ROOKIE, { id: "sl2", leagueSlug: "basketcity-bc8", organization: "basketcity", sourceSlug: "bc8", seasonStart: null, seasonEnd: null }],
    );
    expect(draft.seasonLeagueId).toBe("");
    expect(unresolved[0]).toContain("bc8");
  });

  // Two organizations can run inside one season. A /men/ URL is BasketCity's,
  // so a Jumpball league must not become a candidate for it. Without the
  // organization filter this resolves to "" with "Several active leagues match".
  it("ignores another organization's league when resolving a /men/ URL", () => {
    const { draft, unresolved } = resolve(
      scrapedData([onRoster], "https://basketcity.sportstats.gr/men/gamedetails/id/99"),
      roster,
      [
        { id: "slBC", leagueSlug: "basketcity-bc8",  organization: "basketcity", sourceSlug: "bc8",    seasonStart: null, seasonEnd: null },
        { id: "slJB", leagueSlug: "jumpball-golden", organization: "jumpball",   sourceSlug: "golden", seasonStart: null, seasonEnd: null },
      ],
    );
    expect(draft.seasonLeagueId).toBe("slBC");
    expect(unresolved).toHaveLength(0);
  });

  // Both organizations run a "Rookie League", so the source slug alone is
  // ambiguous and only the URL's host settles it.
  it("picks the right league when both organizations share a source slug", () => {
    const { draft, unresolved } = resolve(
      scrapedData([onRoster], "https://www.jumpball.com.gr/event/armani-katehano-vs-rivals/"),
      roster,
      [
        { id: "slBC", leagueSlug: "basketcity-rookie", organization: "basketcity", sourceSlug: "rookie", seasonStart: null, seasonEnd: null },
        { id: "slJB", leagueSlug: "jumpball-rookie",   organization: "jumpball",   sourceSlug: "rookie", seasonStart: null, seasonEnd: null },
      ],
      { leagueSlug: "rookie" },
    );
    expect(draft.seasonLeagueId).toBe("slJB");
    expect(unresolved).toHaveLength(0);
  });

  it("blocks a /men/ URL when no league is active", () => {
    const { draft, unresolved } = resolve(
      scrapedData([onRoster], "https://example.com/men/game/99"),
      roster,
      [{ id: "slW", leagueSlug: "basketcity-wintercup", organization: "basketcity", sourceSlug: "wintercup", seasonStart: null, seasonEnd: null }],
    );
    expect(draft.seasonLeagueId).toBe("");
    expect(unresolved).toHaveLength(1);
  });
});

describe("resolve game fields", () => {
  it("throws when our team is not among the scraped teams", () => {
    const data = scrapedData([onRoster]);
    data.teams = [{ name: "Rivals", players: [] }, { name: "Others", players: [] }];
    expect(() => resolve(data, roster, [ROOKIE])).toThrow(/not found/i);
  });

  it("derives opponent, home and result from our side of the payload", () => {
    const { draft } = resolve(scrapedData([onRoster]), roster, [ROOKIE]);
    expect(draft.opponent).toBe("Rivals");
    expect(draft.home).toBe(true);
    expect(draft.result).toBe("W");
    expect(draft.teamScore).toBe(60);
    expect(draft.opponentScore).toBe(55);
  });
});

describe("resolve opponent naming", () => {
  function against(name) {
    const data = scrapedData([onRoster]);
    data.game.awayTeam = name;
    data.teams[1].name = name;
    return resolve(data, roster, [ROOKIE]);
  }

  it("renames a known opponent the way the site shows it", () => {
    const { draft, unknownOpponent } = against("ΓΕΡΟΛΥΚΟΙ B.C.");
    expect(draft.opponent).toBe("Gerolykoi");
    expect(unknownOpponent).toBeUndefined();
  });

  // No mechanical rule gets here, which is why the map is explicit.
  it("handles names that are not a case transformation", () => {
    expect(against("S.H.A.W.").draft.opponent).toBe("Shaw");
    expect(against("TAZ BOYS").draft.opponent).toBe("Taz Boyz");
  });

  it("ignores spacing and case differences in the source", () => {
    expect(against("  cappuccino   knights ").draft.opponent).toBe("Cappuccino Knights");
  });

  // The form shows the raw name and lets a person fix it; the poll reads
  // unknownOpponent and stops rather than publishing the source's spelling.
  it("keeps the source spelling and flags an unmapped opponent", () => {
    const { draft, unknownOpponent } = against("BRAND NEW TEAM");
    expect(draft.opponent).toBe("BRAND NEW TEAM");
    expect(unknownOpponent).toBe("BRAND NEW TEAM");
  });
});

describe("toCommitInput", () => {
  const draft = {
    date: "2026-01-01", opponent: "A", home: false, result: "L",
    teamScore: 55, opponentScore: 60, seasonLeagueId: "sl1", sourceUrl: "https://x/men/1",
    boxScore: [{
      playerId: "p1", min: 21.5, pts: 11, reb: 4, orb: 1, drb: 3,
      ast: 2, stl: 1, blk: 0, tov: 2, pf: 3,
      fgm: 99, fga: 99, fg2m: 3, fg2a: 5, fg3m: 1, fg3a: 2,
      ftm: 2, fta: 2, eff: 12,
    }],
  };

  it("re-derives fgm and fga from the 2PT and 3PT splits the form edits", () => {
    const [row] = toCommitInput(draft).boxScore;
    expect(row.fgm).toBe(4);
    expect(row.fga).toBe(7);
  });

  it("renames min to minutes and drops eff, which has no stat column", () => {
    const [row] = toCommitInput(draft).boxScore;
    expect(row.minutes).toBe(21.5);
    expect(row).not.toHaveProperty("min");
    expect(row).not.toHaveProperty("eff");
  });

  it("maps home to the location the write schema expects", () => {
    expect(toCommitInput(draft).location).toBe("away");
    expect(toCommitInput({ ...draft, home: true }).location).toBe("home");
  });
});

describe("diffDraft", () => {
  const base = {
    date: "2026-01-01", opponent: "A", home: true, result: "W",
    teamScore: 60, opponentScore: 55, seasonLeagueId: "sl1", sourceUrl: null,
    boxScore: [{ playerId: "p1", pts: 10 }, { playerId: "p2", pts: 5 }],
  };

  it("reports changed top-level and box fields, ignores unchanged ones", () => {
    const final = {
      ...base,
      opponent: "B",
      boxScore: [{ playerId: "p1", pts: 12 }, { playerId: "p2", pts: 5 }],
    };
    const paths = diffDraft(base, final).map(d => d.path);
    expect(paths).toContain("opponent");
    expect(paths).toContain("box.p1.pts");
    expect(paths).not.toContain("box.p2.pts");
    expect(paths).not.toContain("teamScore");
  });

  it("returns empty when nothing changed", () => {
    const clone = { ...base, boxScore: base.boxScore.map(r => ({ ...r })) };
    expect(diffDraft(base, clone)).toHaveLength(0);
  });
});
