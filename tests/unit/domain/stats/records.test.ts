import { describe, it, expect } from "vitest";
import { personalBests, teamRecords, playerGameRecords } from "@/domain/stats/records";

const game = (over: Record<string, unknown> = {}) => ({
  gameId: "g1", opponent: "Dragons", date: "2026-01-10",
  pts: 0, reb: 0, ast: 0, fg3m: 0,
  ...over,
});

describe("personalBests", () => {
  it("reports the best game for each stat with where it happened", () => {
    const highs = personalBests([
      game({ gameId: "g1", opponent: "Dragons", date: "2026-01-10", pts: 18, reb: 11, ast: 2 }),
      game({ gameId: "g2", opponent: "Hawks",   date: "2026-01-17", pts: 24, reb: 4,  ast: 7 }),
    ]);
    expect(highs.map(h => [h.key, h.value, h.opponent])).toEqual([
      ["pts", 24, "Hawks"],
      ["reb", 11, "Dragons"],
      ["ast", 7,  "Hawks"],
    ]);
    expect(highs[0].gameId).toBe("g2");
    expect(highs[0].date).toBe("2026-01-17");
  });

  // The one a fan remembers is the one they just watched.
  it("gives a tie to the most recent game", () => {
    const highs = personalBests([
      game({ gameId: "g1", date: "2026-01-10", opponent: "Dragons", pts: 20 }),
      game({ gameId: "g2", date: "2026-01-17", opponent: "Hawks",   pts: 20 }),
    ]);
    expect(highs[0].gameId).toBe("g2");
  });

  // The caller filters this log by season and by playoff round, so it arrives
  // in whatever order those leave behind.
  it("settles a tie on the date even when the log is out of order", () => {
    const highs = personalBests([
      game({ gameId: "g2", date: "2026-01-17", opponent: "Hawks",   pts: 20 }),
      game({ gameId: "g1", date: "2026-01-10", opponent: "Dragons", pts: 20 }),
    ]);
    expect(highs[0].gameId).toBe("g2");
  });

  // Otherwise a player who has never hit a three gets "0 3PM vs Dragons".
  it("leaves out a stat that has never been recorded", () => {
    const highs = personalBests([game({ pts: 12, reb: 3, ast: 1, fg3m: 0 })]);
    expect(highs.map(h => h.key)).toEqual(["pts", "reb", "ast"]);
  });

  it("reports nothing for a player with no games", () => {
    expect(personalBests([])).toEqual([]);
    expect(personalBests(null)).toEqual([]);
  });
});

const g = (over: Record<string, unknown> = {}) => ({
  id: "g1", date: "2026-01-10", opponent: "Dragons", result: "W",
  score: "60-50", home: true, boxScore: [],
  ...over,
});

describe("teamRecords", () => {
  const SEASON = [
    g({ id: "g1", date: "2025-12-06", opponent: "Dragons", result: "W", score: "60-50" }),
    g({ id: "g2", date: "2025-12-13", opponent: "Hawks",   result: "W", score: "72-41", home: false }),
    g({ id: "g3", date: "2025-12-20", opponent: "Bricks",  result: "L", score: "48-55" }),
    g({ id: "g4", date: "2026-01-10", opponent: "Huskies", result: "W", score: "55-28" }),
  ];

  it("finds the best game for each record and where to read it", () => {
    const byKey = Object.fromEntries(teamRecords(SEASON).map(r => [r.key, r]));
    expect(byKey.points.value).toBe("72");
    expect(byKey.points.gameId).toBe("g2");
    expect(byKey.points.home).toBe(false);
    expect(byKey.margin.value).toBe("+31");
    expect(byKey.margin.gameId).toBe("g2");
    expect(byKey.defense.value).toBe("28");
    expect(byKey.defense.gameId).toBe("g4");
  });

  // computeRecord reports the run the team is on now, which a loss ends. The
  // longest run it ever had stays a record after that.
  it("reports the longest win run, not the current one", () => {
    const streak = teamRecords([
      g({ id: "a", date: "2025-11-01", result: "W" }),
      g({ id: "b", date: "2025-11-08", result: "W" }),
      g({ id: "c", date: "2025-11-15", result: "W" }),
      g({ id: "d", date: "2025-11-22", result: "L" }),
      g({ id: "e", date: "2025-11-29", result: "W" }),
    ]).find(r => r.key === "streak");
    expect(streak?.value).toBe("3");
    expect(streak?.from).toBe("2025-11-01");
    expect(streak?.to).toBe("2025-11-15");
    expect(streak?.gameId).toBeUndefined();
  });

  // Otherwise the widest margin on the board is the narrowest defeat.
  it("leaves out the best win from a team that has never won", () => {
    const keys = teamRecords([
      g({ result: "L", score: "40-50" }),
      g({ id: "g2", date: "2026-01-17", result: "L", score: "45-48" }),
    ]).map(r => r.key);
    expect(keys).not.toContain("margin");
    expect(keys).toContain("points");
  });

  it("reports nothing before the first game and ignores an unreadable score", () => {
    expect(teamRecords([])).toEqual([]);
    expect(teamRecords(null)).toEqual([]);
    expect(teamRecords([g({ score: "" })])).toEqual([]);
  });
});

describe("playerGameRecords", () => {
  const GAMES = [
    g({ id: "g1", date: "2025-12-06", opponent: "Dragons", boxScore: [
      { pid: "p1", played: true,  pts: 18, reb: 4, ast: 2, stl: 1, blk: 0, fg3m: 2 },
      { pid: "p2", played: true,  pts: 6,  reb: 12, ast: 1, stl: 0, blk: 3, fg3m: 0 },
    ] }),
    g({ id: "g2", date: "2025-12-13", opponent: "Hawks", home: false, boxScore: [
      { pid: "p1", played: true,  pts: 24, reb: 3, ast: 7, stl: 0, blk: 0, fg3m: 1 },
      { pid: "p2", played: false, pts: 99, reb: 99, ast: 99, stl: 9, blk: 9, fg3m: 9 },
    ] }),
  ];

  it("finds the best single game in each stat and who had it", () => {
    const byKey = Object.fromEntries(playerGameRecords(GAMES).map(r => [r.key, r]));
    expect([byKey.pts.value, byKey.pts.playerId, byKey.pts.gameId]).toEqual([24, "p1", "g2"]);
    expect([byKey.reb.value, byKey.reb.playerId]).toEqual([12, "p2"]);
    expect([byKey.ast.value, byKey.ast.playerId]).toEqual([7, "p1"]);
    expect([byKey.blk.value, byKey.blk.playerId]).toEqual([3, "p2"]);
    expect(byKey.pts.home).toBe(false);
  });

  // A did-not-play line carries the stats of nobody.
  it("ignores a line for a player who did not play", () => {
    const stl = playerGameRecords(GAMES).find(r => r.key === "stl");
    expect(stl?.value).toBe(1);
    expect(stl?.playerId).toBe("p1");
  });

  it("reports nothing when no one has played", () => {
    expect(playerGameRecords([])).toEqual([]);
    expect(playerGameRecords(null)).toEqual([]);
  });
});
