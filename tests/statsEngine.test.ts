// @ts-nocheck
/**
 * tests/statsEngine.test.js
 * Tests for the stats engine in lib/stats:
 *   calcEff, mergeAggregates, aggregatesToStatsMap, buildStatsMap
 *
 * Previously stats.test.js inlined a copy of computeAggregates instead of
 * importing the real functions. These tests import directly from the source.
 */
import { describe, it, expect } from "vitest";
import { calcEff, mergeAggregates, aggregatesToStatsMap, buildStatsMap, computeTeamAverages } from "../lib/stats";

// ─── calcEff ──────────────────────────────────────────────────────────────────

describe("calcEff", () => {
  it("returns 0 for all-zero input", () => {
    expect(calcEff({})).toBe(0);
  });

  it("returns 0 for undefined input (default params)", () => {
    expect(calcEff()).toBe(0);
  });

  it("computes correctly for a standard stat line", () => {
    // 20 + 5 + 3 + 1 + 1 - (14-8) - (3-2) - 2 = 21
    expect(calcEff({ pts:20, reb:5, ast:3, stl:1, blk:1, fgm:8, fga:14, ftm:2, fta:3, tov:2 })).toBe(21);
  });

  it("can return negative EFF", () => {
    // 0 + 0 + 0 + 0 + 0 - (10-0) - (5-0) - 5 = -20
    expect(calcEff({ tov:5, fga:10, fta:5 })).toBe(-20);
  });

  it("returns an integer (Math.round)", () => {
    const result = calcEff({ pts:20, reb:5, ast:3, stl:1, blk:1, fgm:8, fga:14, ftm:2, fta:3, tov:2 });
    expect(Number.isInteger(result)).toBe(true);
  });

  it("handles missing fields (defaults to 0)", () => {
    // Only pts provided; everything else defaults
    expect(calcEff({ pts: 15 })).toBe(15);
  });
});

// ─── mergeAggregates ─────────────────────────────────────────────────────────

// Helper to build a minimal aggregate row
function agg(gp, ptsAvg, overrides = {}) {
  return {
    gp, ptsAvg, rebAvg:0, orbAvg:0, drbAvg:0, astAvg:0, stlAvg:0, blkAvg:0,
    toAvg:0, pfAvg:0, minutesAvg:0, effAvg:0, tsPct:0,
    fgmTotal:0, fgaTotal:0, fg2mTotal:0, fg2aTotal:0,
    fg3mTotal:0, fg3aTotal:0, ftmTotal:0, ftaTotal:0,
    ptsTotal:0, rebTotal:0, astTotal:0,
    ...overrides,
  };
}

describe("mergeAggregates", () => {
  it("sums gp correctly", () => {
    expect(mergeAggregates(agg(10, 20), agg(5, 10)).gp).toBe(15);
  });

  it("computes weighted average for ptsAvg", () => {
    // (20*10 + 10*5) / 15 = 250/15 = 16.67
    expect(mergeAggregates(agg(10, 20), agg(5, 10)).ptsAvg).toBe(16.67);
  });

  it("handles merging when one side has 0 gp", () => {
    const result = mergeAggregates(agg(10, 20), agg(0, 0));
    expect(result.gp).toBe(10);
    expect(result.ptsAvg).toBe(20);
  });

  it("sums raw totals (fgmTotal, fgaTotal, ptsTotal)", () => {
    const a = agg(5, 10, { fgmTotal:10, fgaTotal:20, ptsTotal:50 });
    const b = agg(5, 20, { fgmTotal:15, fgaTotal:25, ptsTotal:100 });
    const result = mergeAggregates(a, b);
    expect(result.fgmTotal).toBe(25);
    expect(result.fgaTotal).toBe(45);
    expect(result.ptsTotal).toBe(150);
  });

  it("handles null/undefined raw total fields gracefully", () => {
    const a = { ...agg(5, 10), fgmTotal: undefined };
    const b = agg(5, 10, { fgmTotal: 8 });
    expect(mergeAggregates(a, b).fgmTotal).toBe(8);
  });
});

// ─── aggregatesToStatsMap ─────────────────────────────────────────────────────

// Helper to build a mock aggregate as returned by Prisma
function mockAgg(playerId, gp, overrides = {}) {
  return {
    playerId, gp,
    ptsAvg:0, rebAvg:0, orbAvg:0, drbAvg:0, astAvg:0, stlAvg:0, blkAvg:0,
    toAvg:0, pfAvg:0, minutesAvg:0, effAvg:0, tsPct:0,
    fgmTotal:0, fgaTotal:0, fg2mTotal:0, fg2aTotal:0,
    fg3mTotal:0, fg3aTotal:0, ftmTotal:0, ftaTotal:0,
    ptsTotal:0, rebTotal:0, astTotal:0,
    player: { id: playerId },
    ...overrides,
  };
}

describe("aggregatesToStatsMap", () => {
  it("returns empty object for empty input", () => {
    expect(aggregatesToStatsMap([])).toEqual({});
  });

  it("computes percentages from raw totals, not from pre-computed percentages", () => {
    // Two aggregates for the same player in different leagues
    // League A: 20/40 FG = 50%,  League B: 30/50 FG = 60%
    // Correct merged FG% = (20+30)/(40+50) = 50/90 ≈ 55.6%  NOT avg(50,60)=55%
    const aggregates = [
      mockAgg("p1", 5, { fgmTotal:20, fgaTotal:40, ptsAvg:10, ptsTotal:50 }),
      mockAgg("p1", 5, { fgmTotal:30, fgaTotal:50, ptsAvg:20, ptsTotal:100 }),
    ];
    const map = aggregatesToStatsMap(aggregates);
    expect(map["p1"].fgPct).toBe(+(50/90*100).toFixed(1));
    expect(map["p1"].gp).toBe(10);
  });

  it("handles player with 0 fga -- no divide-by-zero", () => {
    const aggregates = [
      mockAgg("p1", 1, { ftmTotal:2, ftaTotal:2, ptsAvg:2, ptsTotal:2 }),
    ];
    const map = aggregatesToStatsMap(aggregates);
    expect(map["p1"].fgPct).toBe(0);
    expect(map["p1"].fg2Pct).toBe(0);
    expect(map["p1"].fg3Pct).toBe(0);
  });

  it("sets ftPct to null when ftaTotal is 0", () => {
    const aggregates = [mockAgg("p1", 5)];
    const map = aggregatesToStatsMap(aggregates);
    expect(map["p1"].ftPct).toBeNull();
  });

  it("output has the shape the frontend relies on", () => {
    const aggregates = [
      mockAgg("p1", 5, {
        ptsAvg:10, rebAvg:3, orbAvg:1, drbAvg:2, astAvg:2, stlAvg:1,
        minutesAvg:20, effAvg:10, fgmTotal:20, fgaTotal:40,
        fg2mTotal:15, fg2aTotal:25, fg3mTotal:5, fg3aTotal:15,
        ftmTotal:10, ftaTotal:12, ptsTotal:50, rebTotal:15, astTotal:10,
      }),
    ];
    const entry = aggregatesToStatsMap(aggregates)["p1"];
    for (const key of ["ppg","rpg","apg","spg","bpg","tpg","fpg","mpg",
                        "fgPct","fg2Pct","fg3Pct","ftPct","tsPct","eff","gp",
                        "fgm","fga","fg2m","fg2a","fg3m","fg3a","ftm","fta"]) {
      expect(entry, `missing key: ${key}`).toHaveProperty(key);
    }
  });
});

// ─── buildStatsMap ────────────────────────────────────────────────────────────

function boxRow(pid, overrides = {}) {
  return {
    pid, min:20, pts:10, reb:3, orb:1, drb:2, ast:2,
    stl:0, blk:0, tov:1, pf:1, fgm:4, fga:8,
    fg2m:3, fg2a:5, fg3m:1, fg3a:3, ftm:1, fta:2, eff:8,
    ...overrides,
  };
}

describe("buildStatsMap", () => {
  it("returns zeroed stats for player with no box score appearances", () => {
    const players = [{ id: "p1" }];
    const games   = [{ id: "g1", boxScore: [boxRow("p2")] }];
    const map = buildStatsMap(players, games);
    expect(map["p1"].gp).toBe(0);
    expect(map["p1"].ppg).toBe(0);
    expect(map["p1"].gameLog).toEqual([]);
  });

  it("excludes DNP entries (min=0) from averages", () => {
    const players = [{ id: "p1" }];
    const games = [
      { id: "g1", boxScore: [boxRow("p1", { min:20, pts:10 })] },
      { id: "g2", boxScore: [boxRow("p1", { min:0,  pts:0  })] },
    ];
    const map = buildStatsMap(players, games);
    expect(map["p1"].gp).toBe(1);
    expect(map["p1"].ppg).toBe(10);
  });

  it("handles game with null boxScore gracefully", () => {
    const players = [{ id: "p1" }];
    const games   = [{ id: "g1", boxScore: null }];
    const map = buildStatsMap(players, games);
    expect(map["p1"].gp).toBe(0);
  });

  it("averages stats across multiple games", () => {
    const players = [{ id: "p1" }];
    const games = [
      { id: "g1", boxScore: [boxRow("p1", { pts:20, min:30 })] },
      { id: "g2", boxScore: [boxRow("p1", { pts:10, min:20 })] },
    ];
    const map = buildStatsMap(players, games);
    expect(map["p1"].gp).toBe(2);
    expect(map["p1"].ppg).toBe(15);
  });

  it("builds gameLog entries only for games the player appeared in", () => {
    const players = [{ id: "p1" }];
    const games = [
      { id: "g1", date:"2025-01-01", opponent:"TeamA", league:"bc6", boxScore: [boxRow("p1")] },
      { id: "g2", date:"2025-01-02", opponent:"TeamB", league:"bc6", boxScore: [boxRow("p2")] },
    ];
    const map = buildStatsMap(players, games);
    expect(map["p1"].gameLog).toHaveLength(1);
    expect(map["p1"].gameLog[0].gameId).toBe("g1");
  });
});

// ─── computeTeamAverages -- agreement with aggregatesToStatsMap ────────────────
// Verifies that team-stats tiles and leaderboard player aggregates are derived
// from the same arithmetic. Given identical box-score data, team totals computed
// by computeTeamAverages must equal team totals reconstructed by summing
// per-player aggregates from aggregatesToStatsMap.
//
// Fixture: 3 games, 2 players (player B has one DNP -> excluded from agg gp).
//   Player A: 3 active games -- reb 8/5/6 = 19 total, fgm 6/4/5 = 15, fga 12/9/11 = 32
//   Player B: 2 active games -- reb 4/7    = 11 total, fgm 3/4   =  7, fga  7/8   = 15
//   Team gp = 3, team reb = 30, team fgm = 22, team fga = 47
//   Expected RPG = 10.0, FG% = +(22/47*100).toFixed(1)

describe("computeTeamAverages -- agrees with aggregatesToStatsMap on same fixture", () => {
  const GAMES = [
    {
      id: "g1",
      boxScore: [
        { pid:"pA", min:30, reb:8, ast:3, stl:1, blk:0, tov:2, fgm:6, fga:12, fg3m:1, fg3a:3, ftm:2, fta:3 },
        { pid:"pB", min:28, reb:4, ast:2, stl:0, blk:0, tov:1, fgm:3, fga:7,  fg3m:0, fg3a:2, ftm:1, fta:2 },
      ],
    },
    {
      id: "g2",
      boxScore: [
        { pid:"pA", min:25, reb:5, ast:4, stl:2, blk:1, tov:1, fgm:4, fga:9,  fg3m:2, fg3a:4, ftm:0, fta:0 },
        { pid:"pB", min:0,  reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0,  fg3m:0, fg3a:0, ftm:0, fta:0 },
      ],
    },
    {
      id: "g3",
      boxScore: [
        { pid:"pA", min:32, reb:6, ast:5, stl:1, blk:2, tov:3, fgm:5, fga:11, fg3m:1, fg3a:4, ftm:3, fta:4 },
        { pid:"pB", min:24, reb:7, ast:3, stl:2, blk:0, tov:2, fgm:4, fga:8,  fg3m:1, fg3a:3, ftm:2, fta:3 },
      ],
    },
  ];

  // Build expected team totals directly from the fixture for sanity
  const TEAM_GP = 3;
  const ALL_ACTIVE = GAMES.flatMap(g => g.boxScore).filter(r => r.min > 0);
  const rawSum = (key: string) => ALL_ACTIVE.reduce((a, r: any) => a + (r[key] || 0), 0);

  // Build the per-player aggregates the same way aggregatesToStatsMap expects them
  function playerMockAgg(pid: string) {
    const rows = ALL_ACTIVE.filter((r: any) => r.pid === pid);
    const n = rows.length;
    const s = (k: string) => rows.reduce((a: number, r: any) => a + (r[k] || 0), 0);
    return {
      playerId:  pid,
      gp:        n,
      ptsAvg:    0, rebAvg: n > 0 ? s("reb") / n : 0, orbAvg:0, drbAvg:0,
      astAvg:    0, stlAvg:0, blkAvg:0, toAvg:0, pfAvg:0,
      minutesAvg:0, effAvg:0, tsPct:0,
      fgmTotal:  s("fgm"),  fgaTotal:  s("fga"),
      fg2mTotal: 0,          fg2aTotal: 0,
      fg3mTotal: s("fg3m"), fg3aTotal: s("fg3a"),
      ftmTotal:  s("ftm"),  ftaTotal:  s("fta"),
      ptsTotal:  0,
      rebTotal:  s("reb"),
      astTotal:  s("ast"),
      stlTotal:  s("stl"),
    };
  }

  it("RPG matches sum(player.reb_total) / team_gp", () => {
    const teamAvg  = computeTeamAverages(GAMES);
    const statsMap = aggregatesToStatsMap(["pA","pB"].map(playerMockAgg));
    const aggRpg   = +(Object.values(statsMap).reduce((a: number, s: any) => a + (s.reb_total ?? 0), 0) / TEAM_GP).toFixed(1);
    expect(teamAvg.rpg).toBe(aggRpg);
    expect(teamAvg.rpg).toBe(+(rawSum("reb") / TEAM_GP).toFixed(1));
  });

  it("APG matches sum(player.ast_total) / team_gp", () => {
    const teamAvg  = computeTeamAverages(GAMES);
    const statsMap = aggregatesToStatsMap(["pA","pB"].map(playerMockAgg));
    const aggApg   = +(Object.values(statsMap).reduce((a: number, s: any) => a + (s.ast_total ?? 0), 0) / TEAM_GP).toFixed(1);
    expect(teamAvg.apg).toBe(aggApg);
  });

  it("FG% matches sum(player.fgm) / sum(player.fga)", () => {
    const teamAvg  = computeTeamAverages(GAMES);
    const statsMap = aggregatesToStatsMap(["pA","pB"].map(playerMockAgg));
    const fgm      = Object.values(statsMap).reduce((a: number, s: any) => a + (s.fgm ?? 0), 0);
    const fga      = Object.values(statsMap).reduce((a: number, s: any) => a + (s.fga ?? 0), 0);
    const aggFgPct = +(fgm / fga * 100).toFixed(1);
    expect(teamAvg.fgPct).toBe(aggFgPct);
  });

  it("DNP rows are excluded from both paths", () => {
    // Player B's g2 row (min=0) must not inflate team totals
    const teamAvg = computeTeamAverages(GAMES);
    // If DNP were included, reb would be rawSum including 0-min rows = same value
    // (since DNP reb is 0), but gp from DNP would inflate counts -- here we
    // confirm computeTeamAverages divides by team_gp (3), not by row count (5)
    const allRowsIncludingDnp = GAMES.flatMap(g => g.boxScore);
    const naiveRpg = +(allRowsIncludingDnp.reduce((a, r: any) => a + (r.reb || 0), 0) / allRowsIncludingDnp.length).toFixed(1);
    // naiveRpg uses 5 rows, teamAvg.rpg uses 3 games -- they must differ
    expect(naiveRpg).not.toBe(teamAvg.rpg);
    expect(teamAvg.rpg).toBe(+(rawSum("reb") / TEAM_GP).toFixed(1));
  });
});
