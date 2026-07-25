// @ts-nocheck
import { describe, it, expect } from "vitest";
import { buildDraft } from "@/client/admin/import/build-draft";

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
