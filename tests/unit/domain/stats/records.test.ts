import { describe, it, expect } from "vitest";
import { personalBests } from "@/domain/stats/records";

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
