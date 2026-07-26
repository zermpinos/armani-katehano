// @ts-nocheck
import { describe, it, expect } from "vitest";
import { verify } from "@/domain/import/verify";

function player(over = {}) {
  return {
    "#": 4, Players: "Player Four", MIN: "20:00", PTS: 10,
    REB: 5, OREB: 2, DREB: 3, AST: 1, STL: 0, BLK: 0, TO: 2, PF: 3,
    "2PTS": { made: 2, attempted: 5, pct: 40 },
    "3PTS": { made: 1, attempted: 3, pct: 33.3 },
    FT:     { made: 3, attempted: 4, pct: 75 },
    EF: 11,
    ...over,
  };
}

const rival = over => player({
  "#": 9, Players: "Rival Nine", PTS: 8,
  "2PTS": { made: 4, attempted: 9, pct: 44 },
  "3PTS": { made: 0, attempted: 1, pct: 0 },
  FT:     { made: 0, attempted: 0, pct: 0 },
  ...over,
});

function payload(over = {}) {
  return {
    url: "https://example.com/men/gamedetails/id/X",
    game: {
      homeTeam: "ARMANI KATEHANO",
      awayTeam: "Rivals",
      date: "Σάββατο, 1 Ιανουαρίου 2026",
      finalScore: { home: 10, away: 8 },
    },
    teams: [
      { name: "ARMANI KATEHANO", players: [player()] },
      { name: "Rivals",          players: [rival()] },
    ],
    ...over,
  };
}

const checks = r => r.failures.map(f => f.check);

describe("verify", () => {
  it("passes a consistent final box score", () => {
    expect(verify(payload(), "final")).toEqual({ ok: true, failures: [] });
  });

  it("fails when the game is not final", () => {
    expect(checks(verify(payload(), "live"))).toEqual(["state"]);
  });

  it("fails on an unparseable date", () => {
    const raw = payload();
    raw.game.date = "yesterday";
    expect(checks(verify(raw, "final"))).toEqual(["date"]);
  });

  it("fails on a missing date", () => {
    const raw = payload();
    raw.game.date = null;
    expect(checks(verify(raw, "final"))).toEqual(["date"]);
  });

  it("fails when per-player points do not sum to the final score", () => {
    const raw = payload();
    raw.teams[0].players.push(player({
      "#": 7, Players: "Player Seven", PTS: 2,
      "2PTS": { made: 1, attempted: 2, pct: 50 },
      "3PTS": { made: 0, attempted: 0, pct: 0 },
      FT:     { made: 0, attempted: 0, pct: 0 },
    }));
    const r = verify(raw, "final");
    expect(checks(r)).toEqual(["score"]);
    expect(r.failures[0].detail).toContain("sum to 12");
  });

  it("fails when a player's points do not match their made shots", () => {
    const raw = payload();
    raw.teams[0].players[0].PTS = 11;
    raw.game.finalScore.home = 11;
    const r = verify(raw, "final");
    expect(checks(r)).toEqual(["player-points"]);
    expect(r.failures[0].detail).toContain("shots total 10");
  });

  it("checks the opponent box score too", () => {
    const raw = payload();
    raw.teams[1].players[0].PTS = 9;
    raw.game.finalScore.away = 9;
    const r = verify(raw, "final");
    expect(checks(r)).toEqual(["player-points"]);
    expect(r.failures[0].detail).toContain("Rivals");
  });

  it("fails when a column the resolver reads is absent", () => {
    const raw = payload();
    delete raw.teams[0].players[0].EF;
    const r = verify(raw, "final");
    expect(checks(r)).toEqual(["columns"]);
    expect(r.failures[0].detail).toContain("EF");
  });

  it("reports a missing column once per team, not once per player", () => {
    const raw = payload();
    raw.teams[0].players.push(player({ "#": 7, PTS: 0, "2PTS": null, "3PTS": null, FT: null }));
    raw.teams[0].players.forEach(p => { delete p.OREB; });
    expect(checks(verify(raw, "final"))).toEqual(["columns"]);
  });

  it("fails when no box score section matches a team name", () => {
    const raw = payload();
    raw.teams[1].name = "Someone Else";
    const r = verify(raw, "final");
    expect(checks(r)).toEqual(["teams"]);
    expect(r.failures[0].detail).toContain("away");
  });

  it("matches team names across whitespace and case differences", () => {
    const raw = payload();
    raw.teams[0].name = "  armani   katehano ";
    expect(verify(raw, "final").ok).toBe(true);
  });

  it("accepts a bench player with no shot cells", () => {
    const raw = payload();
    raw.teams[0].players.push(player({
      "#": 12, Players: "Bench", MIN: "0", PTS: 0,
      REB: 0, OREB: 0, DREB: 0, AST: 0, STL: 0, BLK: 0, TO: 0, PF: 0,
      "2PTS": null, "3PTS": null, FT: null, EF: 0,
    }));
    expect(verify(raw, "final").ok).toBe(true);
  });

  it("collects every failure rather than stopping at the first", () => {
    const raw = payload();
    raw.game.date = "";
    raw.teams[0].players[0].PTS = 99;
    expect(checks(verify(raw, "live")).sort())
      .toEqual(["date", "player-points", "score", "state"]);
  });
});
