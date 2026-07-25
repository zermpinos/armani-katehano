// @ts-nocheck
import { describe, it, expect } from "vitest";
import { buildDraft, diffDraft } from "@/client/admin/import/build-draft";

const players = [
  { id: "p1", number: 4, name: "On Roster" },
  { id: "p2", number: 7, name: "Also Roster" },
];
const seasonLeagues = [{ id: "sl1", leagueSlug: "rookie", leagueName: "Rookie" }];

function scrapedData(akPlayers) {
  return {
    game: {
      homeTeam: "ARMANI KATEHANO",
      awayTeam: "Rivals",
      date: "1 Ianouariou 2026",
      finalScore: { home: 60, away: 55 },
    },
    teams: [
      { name: "ARMANI KATEHANO", players: akPlayers },
      { name: "Rivals", players: [] },
    ],
    url: "https://example.com/rookie/game/123",
  };
}

describe("buildDraft roster guard", () => {
  it("flags a scraped player with minutes who is not on the roster", () => {
    const { unresolved } = buildDraft(
      scrapedData([
        { "#": 4, Players: "On Roster", MIN: "20:00", PTS: 10 },
        { "#": 99, Players: "New Guy", MIN: "15:00", PTS: 8 },
      ]),
      players,
      seasonLeagues,
    );
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toContain("#99");
  });

  it("does not flag when every scraped player with minutes is on the roster", () => {
    const { unresolved } = buildDraft(
      scrapedData([
        { "#": 4, Players: "On Roster", MIN: "20:00", PTS: 10 },
        { "#": 7, Players: "Also Roster", MIN: "18:00", PTS: 6 },
      ]),
      players,
      seasonLeagues,
    );
    expect(unresolved).toHaveLength(0);
  });

  it("ignores a non-roster jersey that did not play", () => {
    const { unresolved } = buildDraft(
      scrapedData([
        { "#": 4, Players: "On Roster", MIN: "20:00", PTS: 10 },
        { "#": 99, Players: "Bench", MIN: "0", PTS: 0 },
      ]),
      players,
      seasonLeagues,
    );
    expect(unresolved).toHaveLength(0);
  });

  it("leaves seasonLeagueId empty when no league matches, with no silent fallback", () => {
    const { draft } = buildDraft(
      scrapedData([{ "#": 4, Players: "On Roster", MIN: "20:00", PTS: 10 }]),
      players,
      [{ id: "slX", leagueSlug: "bc6", leagueName: "BC6" }],
    );
    expect(draft.seasonLeagueId).toBe("");
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
