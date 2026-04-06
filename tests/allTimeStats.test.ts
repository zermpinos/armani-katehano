// @ts-nocheck
/**
 * tests/allTimeStats.test.js
 *
 * Tests for buildAllTimeStatsMap() in lib/stats  (T-05 in the audit).
 *
 * buildAllTimeStatsMap() performs weighted averaging across seasons -- a subtle
 * calculation that is easy to break at edge cases:
 *   - one season with 1 game vs another with 20 (weight must reflect gp)
 *   - player present in only one season
 *   - all-zero season mixed with a productive one
 *   - single season (no cross-season averaging needed)
 */

import { describe, it, expect } from "vitest";
import { buildAllTimeStatsMap } from "../lib/stats";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/** Minimal SeasonStats object matching the shape buildStatsMap returns. */
function seasonStats(gp, ppg, rpg = 0, apg = 0, fgPct = 0) {
  return {
    gp, ppg, rpg, apg,
    orpg: 0, drpg: 0, spg: 0, bpg: 0, tpg: 0, fpg: 0,
    fg2Pct: 0, fg3Pct: 0, ftPct: fgPct, mpg: 0, eff: 0,
    fgPct,
    gameLog: [],
  };
}

const P1 = "player-1";
const P2 = "player-2";

// ─── Single season ────────────────────────────────────────────────────────────

describe("buildAllTimeStatsMap -- single season", () => {
  it("returns the season stats unchanged when there is only one season", () => {
    const allSeasons = {
      "season-1": { [P1]: seasonStats(10, 15.0, 5.0) },
    };
    const map = buildAllTimeStatsMap(allSeasons, [{ id: P1 }]);

    expect(map[P1].gp).toBe(10);
    expect(map[P1].ppg).toBe(15.0);
    expect(map[P1].rpg).toBe(5.0);
  });

  it("returns zeros for a player with 0 games in a single season", () => {
    const allSeasons = {
      "season-1": { [P1]: seasonStats(0, 0) },
    };
    const map = buildAllTimeStatsMap(allSeasons, [{ id: P1 }]);

    expect(map[P1].gp).toBe(0);
    expect(map[P1].ppg).toBe(0);
  });
});

// ─── Weighted averaging ───────────────────────────────────────────────────────

describe("buildAllTimeStatsMap -- weighted averages across seasons", () => {
  it("weights ppg by games played correctly", () => {
    // Season A: 10 games, 20 ppg -> contributes 200 pts
    // Season B: 10 games, 10 ppg -> contributes 100 pts
    // All-time: 20 games, 15 ppg weighted
    const allSeasons = {
      "s-a": { [P1]: seasonStats(10, 20.0) },
      "s-b": { [P1]: seasonStats(10, 10.0) },
    };
    const map = buildAllTimeStatsMap(allSeasons, [{ id: P1 }]);

    expect(map[P1].gp).toBe(20);
    expect(map[P1].ppg).toBe(15.0);
  });

  it("correctly weights when seasons have very different game counts", () => {
    // Season A: 1 game, 30 ppg  -> contributes 30 pts
    // Season B: 20 games, 10 ppg -> contributes 200 pts
    // All-time: 21 games, 230/21 ≈ 11.0 ppg
    const allSeasons = {
      "s-a": { [P1]: seasonStats(1,  30.0) },
      "s-b": { [P1]: seasonStats(20, 10.0) },
    };
    const map = buildAllTimeStatsMap(allSeasons, [{ id: P1 }]);

    expect(map[P1].gp).toBe(21);
    expect(map[P1].ppg).toBe(+((30 + 200) / 21).toFixed(1));
  });

  it("accumulates total gp correctly across three seasons", () => {
    const allSeasons = {
      "s-1": { [P1]: seasonStats(5,  12.0) },
      "s-2": { [P1]: seasonStats(8,  14.0) },
      "s-3": { [P1]: seasonStats(12, 18.0) },
    };
    const map = buildAllTimeStatsMap(allSeasons, [{ id: P1 }]);
    expect(map[P1].gp).toBe(25);
  });
});

// ─── Player present in only one season ───────────────────────────────────────

describe("buildAllTimeStatsMap -- player missing from some seasons", () => {
  it("uses only the seasons where the player appeared", () => {
    // P1 plays in s-1 and s-2; P2 only in s-2
    const allSeasons = {
      "s-1": {
        [P1]: seasonStats(10, 15.0),
        // P2 not present in s-1
      },
      "s-2": {
        [P1]: seasonStats(10, 20.0),
        [P2]: seasonStats(8,  12.0),
      },
    };
    const map = buildAllTimeStatsMap(allSeasons, [{ id: P1 }, { id: P2 }]);

    // P1: (10*15 + 10*20) / 20 = 17.5
    expect(map[P1].gp).toBe(20);
    expect(map[P1].ppg).toBe(17.5);

    // P2: only s-2 -- stats should be exactly s-2 stats
    expect(map[P2].gp).toBe(8);
    expect(map[P2].ppg).toBe(12.0);
  });

  it("returns zeros for a player who never appeared in any season", () => {
    const allSeasons = {
      "s-1": { [P1]: seasonStats(10, 15.0) },
    };
    const map = buildAllTimeStatsMap(allSeasons, [{ id: P1 }, { id: P2 }]);

    expect(map[P2].gp).toBe(0);
    expect(map[P2].ppg).toBe(0);
    expect(map[P2].gameLog).toEqual([]);
  });
});

// ─── All-zero season mixed with productive season ─────────────────────────────

describe("buildAllTimeStatsMap -- zero-stat seasons excluded from averages", () => {
  it("ignores seasons where gp === 0 when computing averages", () => {
    // A season with gp=0 should not drag down the average
    const allSeasons = {
      "s-active": { [P1]: seasonStats(10, 20.0) },
      "s-zero":   { [P1]: seasonStats(0,   0.0) }, // gp=0 -> excluded
    };
    const map = buildAllTimeStatsMap(allSeasons, [{ id: P1 }]);

    // Should equal the active season only
    expect(map[P1].gp).toBe(10);
    expect(map[P1].ppg).toBe(20.0);
  });
});

// ─── gameLog merging ──────────────────────────────────────────────────────────

describe("buildAllTimeStatsMap -- gameLog merging", () => {
  it("merges and sorts gameLogs from all seasons chronologically", () => {
    const log1 = [{ gameId: "g1", date: "2024-01-01", pts: 10, reb: 3, ast: 2, stl: 1, blk: 0, eff: 10, opponent: "A", league: "rookie" }];
    const log2 = [{ gameId: "g2", date: "2025-03-15", pts: 20, reb: 5, ast: 4, stl: 2, blk: 1, eff: 20, opponent: "B", league: "bc6" }];

    const allSeasons = {
      "s-2024": { [P1]: { ...seasonStats(1, 10), gameLog: log1 } },
      "s-2025": { [P1]: { ...seasonStats(1, 20), gameLog: log2 } },
    };
    const map = buildAllTimeStatsMap(allSeasons, [{ id: P1 }]);

    expect(map[P1].gameLog).toHaveLength(2);
    expect(map[P1].gameLog[0].date).toBe("2024-01-01"); // older first
    expect(map[P1].gameLog[1].date).toBe("2025-03-15");
  });
});
