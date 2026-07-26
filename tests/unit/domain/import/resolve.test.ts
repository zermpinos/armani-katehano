// @ts-nocheck
import { describe, it, expect } from "vitest";
import { resolve, diffDraft } from "@/domain/import/resolve";

const roster = [
  { id: "p1", number: 4 },
  { id: "p2", number: 7 },
];

const ROOKIE = { id: "sl1", leagueSlug: "rookie", seasonStart: "2025-09-01T00:00:00.000Z", seasonEnd: null };

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
    const { unresolved } = resolve(
      scrapedData([onRoster, { "#": 99, Players: "New Guy", MIN: "15:00", PTS: 8 }]),
      roster,
      [ROOKIE],
    );
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toContain("#99");
  });

  it("does not flag when every scraped player with minutes is on the roster", () => {
    const { unresolved } = resolve(
      scrapedData([onRoster, { "#": 7, Players: "Also Roster", MIN: "18:00", PTS: 6 }]),
      roster,
      [ROOKIE],
    );
    expect(unresolved).toHaveLength(0);
  });

  it("ignores a non-roster jersey that did not play", () => {
    const { unresolved } = resolve(
      scrapedData([onRoster, { "#": 99, Players: "Bench", MIN: "0", PTS: 0 }]),
      roster,
      [ROOKIE],
    );
    expect(unresolved).toHaveLength(0);
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
      [{ id: "slX", leagueSlug: "bc6", seasonStart: null, seasonEnd: null }],
    );
    expect(draft.seasonLeagueId).toBe("");
    expect(unresolved.join(" ")).toContain("rookie");
  });

  it("skips a season that ended before the game date", () => {
    const { draft, unresolved } = resolve(
      scrapedData([onRoster]),
      roster,
      [{ id: "slOld", leagueSlug: "rookie", seasonStart: "2024-09-01T00:00:00.000Z", seasonEnd: "2025-06-30T00:00:00.000Z" }],
    );
    expect(draft.seasonLeagueId).toBe("");
    expect(unresolved).toHaveLength(1);
  });

  it("picks the most recent season when a league has several", () => {
    const { draft } = resolve(scrapedData([onRoster]), roster, [
      { id: "slOld", leagueSlug: "rookie", seasonStart: "2024-09-01T00:00:00.000Z", seasonEnd: null },
      { id: "slNew", leagueSlug: "rookie", seasonStart: "2025-09-01T00:00:00.000Z", seasonEnd: null },
    ]);
    expect(draft.seasonLeagueId).toBe("slNew");
  });

  it("resolves a /men/ URL to the single active non-winter league", () => {
    const { draft, unresolved } = resolve(
      scrapedData([onRoster], "https://example.com/men/game/99"),
      roster,
      [ROOKIE, { id: "slW", leagueSlug: "winter-cup", seasonStart: null, seasonEnd: null }],
    );
    expect(draft.seasonLeagueId).toBe("sl1");
    expect(unresolved).toHaveLength(0);
  });

  it("blocks a /men/ URL when several non-winter leagues are active", () => {
    const { draft, unresolved } = resolve(
      scrapedData([onRoster], "https://example.com/men/game/99"),
      roster,
      [ROOKIE, { id: "sl2", leagueSlug: "bc8", seasonStart: null, seasonEnd: null }],
    );
    expect(draft.seasonLeagueId).toBe("");
    expect(unresolved[0]).toContain("bc8");
  });

  it("blocks a /men/ URL when no league is active", () => {
    const { draft, unresolved } = resolve(
      scrapedData([onRoster], "https://example.com/men/game/99"),
      roster,
      [{ id: "slW", leagueSlug: "winter-cup", seasonStart: null, seasonEnd: null }],
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

  it("warns when a player's points do not match their made shots", () => {
    const { warnings } = resolve(
      scrapedData([{ ...onRoster, PTS: 10, "2PTS": { made: 2, attempted: 4 }, "3PTS": { made: 1, attempted: 2 } }]),
      roster,
      [ROOKIE],
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("expected 7");
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
