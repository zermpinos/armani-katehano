import { describe, it, expect } from "vitest";
import { gameToDraft, emptyDraft, toEditRows, toGameBody, validateGameDraft } from "@/client/admin/games/game-draft";
import type { Game, Player } from "@/client/admin/shared";

const players: Player[] = [
  { id: "b", name: "Ben Bravo",  number: 7, position: "SG" },
  { id: "a", name: "Anna Alpha", number: 4, position: "PG" },
];
const game: Game = {
  id: "g1", seasonLeagueId: "sl1", date: "2026-04-12", opponent: "Rivals", home: false,
  result: "W", teamScore: 70, opponentScore: 60, round: "semifinal", notes: "Old gym",
  sourceUrl: "https://example.com/g/1", youtubeUrl: null,
  boxScore: [{
    playerId: "b", minutes: 24, pts: 12, reb: 5, orb: 2, drb: 3, ast: 4, stl: 1, blk: 0, tov: 2, pf: 3,
    fgm: 5, fga: 9, fg2m: 4, fg2a: 6, fg3m: 1, fg3a: 3, ftm: 1, fta: 2,
  }],
};

describe("game draft", () => {
  it("keeps a playoff round, so saving an edit does not turn it into a regular-season game", () => {
    const draft = gameToDraft(game, players);
    expect(draft.round).toBe("semifinal");
    expect(toGameBody(draft, "g1").round).toBe("semifinal");
  });

  it("sends the notes back, since the update stores a missing value as empty", () => {
    expect(toGameBody(gameToDraft(game, players), "g1").notes).toBe("Old gym");
  });

  it("gives every player a row in jersey order, with stored minutes as MIN", () => {
    const rows = toEditRows(players, game.boxScore);
    expect(rows.map(r => r.playerId)).toEqual(["a", "b"]);
    expect(rows[0]).toMatchObject({ min: 0, pts: 0 });
    expect(rows[1]).toMatchObject({ min: 24, pts: 12, fg2m: 4 });
  });

  it("saves MIN as minutes and recomputes FGM and FGA from the splits", () => {
    const draft = gameToDraft(game, players);
    draft.boxScore = draft.boxScore.map(r => (r.playerId === "b" ? { ...r, min: 30, fg2m: 5, fg3a: 4 } : r));
    const row = toGameBody(draft, "g1").boxScore.find(r => r.playerId === "b");
    expect(row).toMatchObject({ minutes: 30, fgm: 6, fga: 10 });
    expect(row).not.toHaveProperty("min");
  });

  it("maps home and empty links the way the API expects", () => {
    const body = toGameBody({ ...emptyDraft("sl1", players), opponent: "X", date: "2026-10-01" }, null);
    expect(body).toMatchObject({
      gameId: undefined, location: "home", sourceUrl: null, youtubeUrl: null, notes: null, round: "regular",
    });
  });

  it("names the first missing field", () => {
    const d = emptyDraft("sl1", players);
    expect(validateGameDraft(d)).toBe("Opponent is required");
    expect(validateGameDraft({ ...d, opponent: "X" })).toBe("Date is required");
    expect(validateGameDraft({ ...d, opponent: "X", date: "2026-10-01", seasonLeagueId: "" })).toBe("League is required");
    expect(validateGameDraft({ ...d, opponent: "X", date: "2026-10-01" })).toBeNull();
  });
});
