// @ts-nocheck
import { describe, it, expect } from "vitest";
import { verify, REQUIRED_COLUMNS } from "@/domain/import/verify";
import { resolve } from "@/domain/import/resolve";

const GREEK_DATE = "Σάββατο, 1 Ιανουαρίου 2026";

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

const QUARTERS = [
  { quarter: "Q1", home: 3, away: 2 },
  { quarter: "Q2", home: 3, away: 2 },
  { quarter: "Q3", home: 2, away: 2 },
  { quarter: "Q4", home: 2, away: 2 },
];

function payload(over = {}) {
  return {
    url: "https://example.com/men/gamedetails/id/X",
    game: {
      homeTeam: "ARMANI KATEHANO",
      awayTeam: "Rivals",
      date: GREEK_DATE,
      finalScore: { home: 10, away: 8 },
      quarterScores: QUARTERS.map(q => ({ ...q })),
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
    expect(verify(payload())).toEqual({ ok: true, failures: [] });
  });

  // Shape taken from a real fixture the organisers published without a result:
  // four zero quarters, a 0-0 final, and no players on either side. Everything
  // agrees with everything, which is exactly why it used to pass.
  it("fails a resultless fixture that is internally consistent about nothing", () => {
    const raw = payload({
      game: {
        homeTeam: "ARMANI KATEHANO",
        awayTeam: "Rivals",
        date: GREEK_DATE,
        finalScore: { home: 0, away: 0 },
        quarterScores: [1, 2, 3, 4].map(n => ({ quarter: `Q${n}`, home: 0, away: 0 })),
      },
      teams: [
        { name: "ARMANI KATEHANO", players: [] },
        { name: "Rivals",          players: [] },
      ],
    });
    const result = verify(raw);
    expect(result.ok).toBe(false);
    expect(checks(result)).toEqual(["empty", "empty"]);
  });

  it("fails when only one side has an empty box score", () => {
    const raw = payload();
    raw.teams[1].players = [];
    expect(checks(verify(raw))).toContain("empty");
  });

  it("reports an empty side once, not once per missing check", () => {
    const raw = payload();
    raw.teams[1].players = [];
    expect(checks(verify(raw)).filter(c => c === "empty")).toHaveLength(1);
  });

  it("fails when the scrape does not classify as final", () => {
    const raw = payload();
    raw.game.quarterScores.pop();
    expect(checks(verify(raw))).toEqual(["state"]);
  });

  it("fails on an unparseable date", () => {
    const raw = payload();
    raw.game.date = "yesterday";
    expect(checks(verify(raw))).toEqual(["date"]);
  });

  it("fails on a missing date", () => {
    const raw = payload();
    raw.game.date = null;
    expect(checks(verify(raw))).toEqual(["date"]);
  });

  it("fails when per-player points do not sum to the final score", () => {
    const raw = payload();
    raw.teams[0].players.push(player({
      "#": 7, Players: "Player Seven", PTS: 2,
      "2PTS": { made: 1, attempted: 2, pct: 50 },
      "3PTS": { made: 0, attempted: 0, pct: 0 },
      FT:     { made: 0, attempted: 0, pct: 0 },
    }));
    const r = verify(raw);
    expect(checks(r)).toEqual(["score"]);
    expect(r.failures[0].detail).toContain("sum to 12");
  });

  it("fails when a player's points do not match their made shots", () => {
    const raw = payload();
    raw.teams[0].players[0].PTS = 11;
    raw.game.finalScore.home = 11;
    const r = verify(raw);
    expect(checks(r)).toEqual(["player-points"]);
    expect(r.failures[0].detail).toContain("shots total 10");
  });

  it("checks the opponent box score too", () => {
    const raw = payload();
    raw.teams[1].players[0].PTS = 9;
    raw.game.finalScore.away = 9;
    const r = verify(raw);
    expect(checks(r)).toEqual(["player-points"]);
    expect(r.failures[0].detail).toContain("Rivals");
  });

  it("fails when a column the resolver reads is absent", () => {
    const raw = payload();
    delete raw.teams[0].players[0].EF;
    const r = verify(raw);
    expect(checks(r)).toEqual(["columns"]);
    expect(r.failures[0].detail).toContain("EF");
  });

  it("reports a missing column once per team, not once per player", () => {
    const raw = payload();
    raw.teams[0].players.push(player({ "#": 7, PTS: 0, "2PTS": null, "3PTS": null, FT: null }));
    raw.teams[0].players.forEach(p => { delete p.OREB; });
    expect(checks(verify(raw))).toEqual(["columns"]);
  });

  it("fails when no box score section matches a team name", () => {
    const raw = payload();
    raw.teams[1].name = "Someone Else";
    const r = verify(raw);
    expect(checks(r)).toEqual(["teams"]);
    expect(r.failures[0].detail).toContain("away");
  });

  it("matches team names across whitespace and case differences", () => {
    const raw = payload();
    raw.teams[0].name = "  armani   katehano ";
    expect(verify(raw).ok).toBe(true);
  });

  it("accepts a bench player with no shot cells", () => {
    const raw = payload();
    raw.teams[0].players.push(player({
      "#": 12, Players: "Bench", MIN: "0", PTS: 0,
      REB: 0, OREB: 0, DREB: 0, AST: 0, STL: 0, BLK: 0, TO: 0, PF: 0,
      "2PTS": null, "3PTS": null, FT: null, EF: 0,
    }));
    expect(verify(raw).ok).toBe(true);
  });

  it("collects every failure rather than stopping at the first", () => {
    const raw = payload();
    raw.game.date = "";
    raw.game.quarterScores.pop();
    raw.teams[0].players[0].PTS = 99;
    expect(checks(verify(raw)).sort())
      .toEqual(["date", "player-points", "score", "state"]);
  });

  // Locks REQUIRED_COLUMNS to what resolve() actually consumes: a column read
  // there but missing here would leave its field zeroed and the canary blind.
  it("covers every column resolve() turns into a box-score field", () => {
    const scraped = { "#": 4, Players: "Player Four", MIN: "20:00" };
    for (const col of REQUIRED_COLUMNS) {
      if (col in scraped) continue;
      Reflect.set(scraped, col, ["2PTS", "3PTS", "FT"].includes(col) ? { made: 2, attempted: 5 } : 7);
    }

    const { draft } = resolve(
      {
        game:  { homeTeam: "ARMANI KATEHANO", awayTeam: "Rivals", date: GREEK_DATE, finalScore: { home: 7, away: 5 } },
        teams: [{ name: "ARMANI KATEHANO", players: [scraped] }, { name: "Rivals", players: [] }],
        url:   "https://example.com/rookie/gamedetails/id/X",
      },
      [{ id: "p1", number: 4 }],
      [{ id: "sl1", leagueSlug: "rookie", seasonStart: "2025-09-01T00:00:00.000Z", seasonEnd: null }],
    );

    for (const [field, value] of Object.entries(draft.boxScore[0]))
      expect(value, `${field} resolved to zero, so its source column is missing from REQUIRED_COLUMNS`).not.toBe(0);
  });
});
