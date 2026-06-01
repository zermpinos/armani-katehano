// @ts-nocheck
/**
 * Tests for computeStatsFromLog() in src/domain/stats/fromLog.ts
 *
 * computeStatsFromLog is the client-side computation path used when a
 * phase filter (regular / playoffs) is active.  It must produce the same
 * per-game averages and shooting percentages as the DB aggregate path
 * (computePlayerAggregates -> aggregatesToStatsMap) for the same raw data.
 *
 * Coverage:
 *   ✓ Empty log returns null
 *   ✓ Single-game values match raw inputs exactly
 *   ✓ Multi-game percentages computed from summed totals, not averaged pcts
 *   ✓ Division by zero for every percentage field when denominator is 0
 *   ✓ ftmPg / ftaPg per-game free-throw rates
 *   ✓ orpg / drpg / tpg / fpg computed from log fields
 *   ✓ Raw totals (pts_total, fgm, fga, ...) correctly summed
 *   ✓ Cross-path agreement: same data through computeStatsFromLog and
 *     computePlayerAggregates + aggregatesToStatsMap yields identical values
 *     for every displayed stat field
 */

import { describe, it, expect } from "vitest";
import { computeStatsFromLog }   from "@/domain/stats/fromLog";
import { computePlayerAggregates } from "@/server/services/stats-recalc";
import { aggregatesToStatsMap }  from "@/domain/stats";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/** A single game-log row as returned by getAllPlayerGameLogs -> rowToGameLogEntry. */
function logRow(overrides = {}) {
  return {
    min:  30, pts: 20, reb: 5,  orb: 1, drb: 4,
    ast:  3,  stl: 1,  blk: 0,  tov: 2, pf:  2,
    fgm:  8,  fga: 16, fg2m: 6, fg2a: 11,
    fg3m: 2,  fg3a: 5, ftm: 2,  fta: 3,
    eff: 18,  // calcEff of the defaults above
    ...overrides,
  };
}

/** Same data in DB row format (minutes instead of min; no eff field). */
function dbRow(overrides = {}) {
  const lr = logRow(overrides);
  const { min, eff, ...rest } = lr;
  return { minutes: min, ...rest };
}

// ─── null on empty log ────────────────────────────────────────────────────────

describe("computeStatsFromLog - empty log", () => {
  it("returns null for an empty array", () => {
    expect(computeStatsFromLog([])).toBeNull();
  });
});

// ─── Single-game values ───────────────────────────────────────────────────────

describe("computeStatsFromLog - single game", () => {
  const row = logRow();
  const stats = computeStatsFromLog([row]);

  it("ppg equals pts", ()   => expect(stats.ppg).toBe(20.0));
  it("rpg equals reb", ()   => expect(stats.rpg).toBe(5.0));
  it("apg equals ast", ()   => expect(stats.apg).toBe(3.0));
  it("spg equals stl", ()   => expect(stats.spg).toBe(1.0));
  it("bpg equals blk", ()   => expect(stats.bpg).toBe(0.0));
  it("tpg equals tov", ()   => expect(stats.tpg).toBe(2.0));
  it("fpg equals pf",  ()   => expect(stats.fpg).toBe(2.0));
  it("mpg equals min", ()   => expect(stats.mpg).toBe(30.0));
  it("orpg equals orb", ()  => expect(stats.orpg).toBe(1.0));
  it("drpg equals drb", ()  => expect(stats.drpg).toBe(4.0));
  it("eff equals pre-computed eff field", () => expect(stats.eff).toBe(18.0));
  it("gp is 1", ()          => expect(stats.gp).toBe(1));
  it("fgPct is 8/16 = 50%", () => expect(stats.fgPct).toBe(50.0));
  it("ftPct is 2/3 = 66.7%", () => expect(stats.ftPct).toBe(+(2/3*100).toFixed(1)));
  it("ftmPg equals ftm", () => expect(stats.ftmPg).toBe(2.0));
  it("ftaPg equals fta", () => expect(stats.ftaPg).toBe(3.0));
  it("pts_total equals pts", () => expect(stats.pts_total).toBe(20));
});

// ─── Multi-game averages ──────────────────────────────────────────────────────

describe("computeStatsFromLog - multi-game averages", () => {
  const rows = [
    logRow({ pts:20, reb:5, min:30 }),
    logRow({ pts:10, reb:9, min:25, eff:12 }),
  ];
  const stats = computeStatsFromLog(rows);

  it("ppg is (20+10)/2 = 15", () => expect(stats.ppg).toBe(15.0));
  it("rpg is (5+9)/2 = 7",    () => expect(stats.rpg).toBe(7.0));
  it("mpg is (30+25)/2 = 27.5", () => expect(stats.mpg).toBe(27.5));
  it("eff averages pre-computed eff values", () => expect(stats.eff).toBe(+((18+12)/2).toFixed(1)));
  it("gp is 2", () => expect(stats.gp).toBe(2));
});

// ─── Percentages from summed totals ──────────────────────────────────────────

describe("computeStatsFromLog - percentages from summed totals, not averaged pcts", () => {
  it("FG% uses summed totals, not average of per-game pcts", () => {
    // Game A: 1/1 = 100%,  Game B: 1/9 = 11.1%
    // Naive avg of pcts = 55.6%
    // From totals = 2/10 = 20.0%  ← correct
    const rows = [
      logRow({ fgm: 1, fga: 1,  fg2m: 1, fg2a: 1, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 }),
      logRow({ fgm: 1, fga: 9,  fg2m: 1, fg2a: 9, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 }),
    ];
    const stats = computeStatsFromLog(rows);

    expect(stats.fgPct).toBe(+(2 / 10 * 100).toFixed(1)); // 20.0
    expect(stats.fgPct).not.toBe(+(( 100 + 11.1 ) / 2).toFixed(1));
  });

  it("3P% uses summed totals", () => {
    const rows = [
      logRow({ fg3m: 3, fg3a: 6, fgm: 3, fga: 6, fg2m: 0, fg2a: 0 }),
      logRow({ fg3m: 1, fg3a: 4, fgm: 1, fga: 4, fg2m: 0, fg2a: 0 }),
    ];
    const stats = computeStatsFromLog(rows);
    expect(stats.fg3Pct).toBe(+(4 / 10 * 100).toFixed(1)); // 40.0
  });

  it("FT% uses summed totals", () => {
    const rows = [
      logRow({ ftm: 4, fta: 4 }),
      logRow({ ftm: 0, fta: 6 }),
    ];
    const stats = computeStatsFromLog(rows);
    expect(stats.ftPct).toBe(+(4 / 10 * 100).toFixed(1)); // 40.0
  });
});

// ─── Division by zero ─────────────────────────────────────────────────────────

describe("computeStatsFromLog - zero-attempt protection", () => {
  const zeroShots = logRow({ fgm:0, fga:0, fg2m:0, fg2a:0, fg3m:0, fg3a:0, ftm:0, fta:0 });
  const stats = computeStatsFromLog([zeroShots]);

  it("fgPct is 0 when fga=0",   () => expect(stats.fgPct).toBe(0));
  it("fg2Pct is 0 when fg2a=0", () => expect(stats.fg2Pct).toBe(0));
  it("fg3Pct is 0 when fg3a=0", () => expect(stats.fg3Pct).toBe(0));
  it("ftPct is 0 when fta=0",   () => expect(stats.ftPct).toBe(0));
  it("ftmPg is 0 when ftm=0",   () => expect(stats.ftmPg).toBe(0));
  it("ftaPg is 0 when fta=0",   () => expect(stats.ftaPg).toBe(0));
});

// ─── Raw totals ───────────────────────────────────────────────────────────────

describe("computeStatsFromLog - raw totals", () => {
  const rows = [
    logRow({ pts:20, reb:5, ast:3, stl:1, fgm:8,  fga:16, ftm:2, fta:3 }),
    logRow({ pts:15, reb:8, ast:5, stl:2, fgm:6,  fga:12, ftm:1, fta:2 }),
    logRow({ pts:10, reb:3, ast:2, stl:0, fgm:4,  fga:10, ftm:1, fta:1 }),
  ];
  const stats = computeStatsFromLog(rows);

  it("pts_total is sum of pts", () => expect(stats.pts_total).toBe(45));
  it("reb_total is sum of reb", () => expect(stats.reb_total).toBe(16));
  it("ast_total is sum of ast", () => expect(stats.ast_total).toBe(10));
  it("stl_total is sum of stl", () => expect(stats.stl_total).toBe(3));
  it("fgm is sum of fgm",       () => expect(stats.fgm).toBe(18));
  it("fga is sum of fga",       () => expect(stats.fga).toBe(38));
  it("ftm is sum of ftm",       () => expect(stats.ftm).toBe(4));
  it("fta is sum of fta",       () => expect(stats.fta).toBe(6));
});

// ─── Cross-path agreement ─────────────────────────────────────────────────────
// The DB aggregate path writes: computePlayerAggregates(dbRows) -> PlayerSeasonAggregate
// then reads: aggregatesToStatsMap([aggregate]) -> display stats.
// The log path computes: computeStatsFromLog(logRows) -> display stats on the fly.
// Both must agree on every displayed stat field for the same underlying game data.
//
// Field naming difference between the two fixture formats:
//   log row: { min, eff, pts, reb, ... }
//   DB row:  { minutes, pts, reb, ... }  (no eff - computed via calcEff inside recalc)
//
// Expected values (derived by hand from the 3-game fixture below):
//   n=3, pts=[20,15,10], reb=[5,8,3], ast=[3,5,2], stl=[1,2,0]
//   fgm=18, fga=38, fg3m=5, fg3a=12, ftm=4, fta=6
//   eff per game: 18, 23, 6  (see inline comments)

describe("computeStatsFromLog ↔ computePlayerAggregates+aggregatesToStatsMap cross-path", () => {
  const LOG_ROWS = [
    logRow({ min:30, pts:20, reb:5,  orb:1, drb:4, ast:3, stl:1, blk:0, tov:2, pf:2,
             fgm:8,  fga:16, fg2m:6, fg2a:11, fg3m:2, fg3a:5, ftm:2, fta:3, eff:18 }),
    logRow({ min:28, pts:15, reb:8,  orb:2, drb:6, ast:5, stl:2, blk:1, tov:1, pf:3,
             fgm:6,  fga:12, fg2m:4, fg2a:8,  fg3m:2, fg3a:4, ftm:1, fta:2, eff:23 }),
    logRow({ min:25, pts:10, reb:3,  orb:0, drb:3, ast:2, stl:0, blk:0, tov:3, pf:1,
             fgm:4,  fga:10, fg2m:3, fg2a:7,  fg3m:1, fg3a:3, ftm:1, fta:1, eff:6  }),
  ];

  const DB_ROWS = LOG_ROWS.map(({ min, eff, ...rest }) => ({ minutes: min, ...rest }));

  const logStats = computeStatsFromLog(LOG_ROWS);

  function dbStats() {
    const agg = computePlayerAggregates(DB_ROWS);
    return aggregatesToStatsMap([{ playerId: "p1", ...agg }])["p1"];
  }

  it("ppg agrees",   () => expect(logStats.ppg).toBe(dbStats().ppg));
  it("rpg agrees",   () => expect(logStats.rpg).toBe(dbStats().rpg));
  it("apg agrees",   () => expect(logStats.apg).toBe(dbStats().apg));
  it("spg agrees",   () => expect(logStats.spg).toBe(dbStats().spg));
  it("bpg agrees",   () => expect(logStats.bpg).toBe(dbStats().bpg));
  it("tpg agrees",   () => expect(logStats.tpg).toBe(dbStats().tpg));
  it("fpg agrees",   () => expect(logStats.fpg).toBe(dbStats().fpg));
  it("mpg agrees",   () => expect(logStats.mpg).toBe(dbStats().mpg));
  it("orpg agrees",  () => expect(logStats.orpg).toBe(dbStats().orpg));
  it("drpg agrees",  () => expect(logStats.drpg).toBe(dbStats().drpg));
  it("eff agrees",   () => expect(logStats.eff).toBe(dbStats().eff));
  it("fgPct agrees", () => expect(logStats.fgPct).toBe(dbStats().fgPct));
  it("fg2Pct agrees",() => expect(logStats.fg2Pct).toBe(dbStats().fg2Pct));
  it("fg3Pct agrees",() => expect(logStats.fg3Pct).toBe(dbStats().fg3Pct));
  it("ftPct agrees", () => expect(logStats.ftPct).toBe(dbStats().ftPct));
  it("gp agrees",    () => expect(logStats.gp).toBe(dbStats().gp));
});
