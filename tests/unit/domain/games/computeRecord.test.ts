// @ts-nocheck
/**
 * tests/computeRecord.test.js
 * Tests for computeRecord() in lib/stats
 *
 * computeRecord drives win/loss tallies, streaks, home/away splits, and ppg
 * on every public page and the team page. It is critical business logic
 * with zero previous test coverage (T-02 in the audit).
 *
 * Coverage targets:
 *   ✓ Empty game array
 *   ✓ Home win / away win
 *   ✓ Home loss / away loss
 *   ✓ Mixed record
 *   ✓ Win streak, loss streak, streak direction flip
 *   ✓ League filter (correct isolation)
 *   ✓ Score parsing - en-dash (DB format) and regular hyphen (fallback)
 *   ✓ Malformed score does not throw
 *   ✓ ppg / oppPpg averages
 *   ✓ gp count
 */

import { describe, it, expect } from "vitest";
import { computeRecord } from "@/domain/games/score";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/**
 * Builds a minimal game object.
 * computeRecord reads: result, home, score, league, date
 */
function g({ result, home, score, league = "rookie", date = "2025-01-01" }) {
  return { result, home, score, league, date };
}

// Canonical game fixtures using en-dash score format (matches DB storage)
const W_HOME  = g({ result: "W", home: true,  score: "85-72" }); // 85-72
const W_AWAY  = g({ result: "W", home: false, score: "72-85" }); // 72-85 (away win: our score first)
const L_HOME  = g({ result: "L", home: true,  score: "70-80" }); // 70-80
const L_AWAY  = g({ result: "L", home: false, score: "65-78" }); // 65-78

// ─── Empty input ──────────────────────────────────────────────────────────────

describe("computeRecord - empty input", () => {
  it("returns all zeros for an empty array", () => {
    const rec = computeRecord([], "rookie");
    expect(rec.wins).toBe(0);
    expect(rec.losses).toBe(0);
    expect(rec.gp).toBe(0);
    expect(rec.streak.count).toBe(0);
    expect(rec.ppg).toBe(0);
    expect(rec.oppPpg).toBe(0);
  });

  it("returns all zeros when no games match the league filter", () => {
    const rec = computeRecord([W_HOME], "pro");
    expect(rec.wins).toBe(0);
    expect(rec.losses).toBe(0);
    expect(rec.gp).toBe(0);
  });
});

// ─── Win / loss tallies ───────────────────────────────────────────────────────

describe("computeRecord - win/loss tallies", () => {
  it("counts a single home win", () => {
    const rec = computeRecord([W_HOME], "rookie");
    expect(rec.wins).toBe(1);
    expect(rec.losses).toBe(0);
    expect(rec.homeWins).toBe(1);
    expect(rec.homeLosses).toBe(0);
  });

  it("counts a single away win", () => {
    const rec = computeRecord([W_AWAY], "rookie");
    expect(rec.wins).toBe(1);
    expect(rec.awayWins).toBe(1);
    expect(rec.awayLosses).toBe(0);
  });

  it("counts a single home loss", () => {
    const rec = computeRecord([L_HOME], "rookie");
    expect(rec.losses).toBe(1);
    expect(rec.wins).toBe(0);
    expect(rec.homeLosses).toBe(1);
  });

  it("counts a mixed record correctly", () => {
    const games = [W_HOME, W_AWAY, L_HOME, W_HOME, L_AWAY];
    const rec = computeRecord(games, "rookie");
    expect(rec.wins).toBe(3);
    expect(rec.losses).toBe(2);
    expect(rec.homeWins).toBe(2);
    expect(rec.homeLosses).toBe(1);
    expect(rec.awayWins).toBe(1);
    expect(rec.awayLosses).toBe(1);
    expect(rec.gp).toBe(5);
  });
});

// ─── Streak ───────────────────────────────────────────────────────────────────

describe("computeRecord - streak calculation", () => {
  it("reports W1 for a single win", () => {
    const rec = computeRecord([W_HOME], "rookie");
    expect(rec.streak.type).toBe("W");
    expect(rec.streak.count).toBe(1);
  });

  it("reports L1 for a single loss", () => {
    const rec = computeRecord([L_HOME], "rookie");
    expect(rec.streak.type).toBe("L");
    expect(rec.streak.count).toBe(1);
  });

  it("reports a win streak of 3", () => {
    // Dates ascending so newest is last - computeRecord sorts newest->oldest internally
    const games = [
      g({ result: "W", home: true,  score: "80-70", date: "2025-01-01" }),
      g({ result: "W", home: false, score: "75-68", date: "2025-01-08" }),
      g({ result: "W", home: true,  score: "90-82", date: "2025-01-15" }),
    ];
    const rec = computeRecord(games, "rookie");
    expect(rec.streak.type).toBe("W");
    expect(rec.streak.count).toBe(3);
  });

  it("reports a loss streak of 2", () => {
    const games = [
      g({ result: "L", home: true,  score: "65-75", date: "2025-01-01" }),
      g({ result: "L", home: false, score: "60-72", date: "2025-01-08" }),
    ];
    const rec = computeRecord(games, "rookie");
    expect(rec.streak.type).toBe("L");
    expect(rec.streak.count).toBe(2);
  });

  it("resets streak when result direction flips", () => {
    // Most recent game (newest date) is a win, prior two are losses
    const games = [
      g({ result: "L", home: true,  score: "65-75", date: "2025-01-01" }),
      g({ result: "L", home: false, score: "60-72", date: "2025-01-08" }),
      g({ result: "W", home: true,  score: "80-70", date: "2025-01-15" }),
    ];
    const rec = computeRecord(games, "rookie");
    expect(rec.streak.type).toBe("W");
    expect(rec.streak.count).toBe(1);
  });
});

// ─── League filter ────────────────────────────────────────────────────────────

describe("computeRecord - league filter", () => {
  const proWin   = g({ result: "W", home: true,  score: "88-75", league: "pro" });
  const rookieW  = g({ result: "W", home: false, score: "72-65", league: "rookie" });
  const rookieL  = g({ result: "L", home: true,  score: "68-78", league: "rookie" });

  it("counts only rookie games when filtering by rookie", () => {
    const rec = computeRecord([proWin, rookieW, rookieL], "rookie");
    expect(rec.wins).toBe(1);
    expect(rec.losses).toBe(1);
    expect(rec.gp).toBe(2);
  });

  it("counts only pro games when filtering by pro", () => {
    const rec = computeRecord([proWin, rookieW, rookieL], "pro");
    expect(rec.wins).toBe(1);
    expect(rec.losses).toBe(0);
    expect(rec.gp).toBe(1);
  });

  it("returns all games when no filter is passed", () => {
    const rec = computeRecord([proWin, rookieW, rookieL]);
    expect(rec.gp).toBe(3);
    expect(rec.wins).toBe(2);
    expect(rec.losses).toBe(1);
  });
});

// ─── Score parsing ────────────────────────────────────────────────────────────

describe("computeRecord - score parsing", () => {
  it("correctly parses en-dash scores (DB format, U+2013)", () => {
    const game = g({ result: "W", home: true, score: "90-70" }); // 90-70
    const rec = computeRecord([game], "rookie");
    expect(rec.ppg).toBe(90);
    expect(rec.oppPpg).toBe(70);
  });

  it("correctly parses regular hyphen scores (fallback format)", () => {
    const game = g({ result: "W", home: true, score: "85-72" });
    const rec = computeRecord([game], "rookie");
    expect(rec.ppg).toBe(85);
    expect(rec.oppPpg).toBe(72);
  });

  it("does not throw on a malformed score string", () => {
    const game = g({ result: "W", home: true, score: "N/A" });
    expect(() => computeRecord([game], "rookie")).not.toThrow();
  });

  it("does not throw on a missing score", () => {
    const game = g({ result: "W", home: true, score: "" });
    expect(() => computeRecord([game], "rookie")).not.toThrow();
  });

  it("calculates correct ppg average across multiple games", () => {
    const games = [
      g({ result: "W", home: true,  score: "80-70" }), // 80
      g({ result: "L", home: false, score: "60-75" }), // 60
    ];
    const rec = computeRecord(games, "rookie");
    expect(rec.ppg).toBe(70);     // (80 + 60) / 2
    expect(rec.oppPpg).toBe(72.5); // (70 + 75) / 2
  });
});
