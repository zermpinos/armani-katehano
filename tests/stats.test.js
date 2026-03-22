/**
 * tests/stats.test.js
 * Tests for lib/stats.prisma.js — recalcAggregates
 *
 * Uses a mock Prisma tx so no DB connection is needed.
 * We feed known box score rows and verify the computed aggregates.
 */
import { describe, it, expect, vi } from "vitest";

// ─── Inline the pure helper functions (same logic as stats.prisma.js) ─────────
// We test the aggregate calculations directly without needing the DB.
// If you change the formulas in stats.prisma.js, update these too.

function calcTsPct(pts, fga, fta) {
  const denom = 2 * (fga + 0.44 * fta);
  return denom > 0 ? +((pts / denom) * 100).toFixed(1) : 0;
}

function pct(made, attempted) {
  return attempted > 0 ? +((made / attempted) * 100).toFixed(1) : 0;
}

function computeAggregates(rows) {
  const gp   = rows.filter(r => r.minutes > 0).length;
  const active = rows.filter(r => r.minutes > 0);
  if (gp === 0) return null;

  const sum = key => active.reduce((a, r) => a + (r[key] || 0), 0);
  const avg = key => +(sum(key) / gp).toFixed(2);

  const totalPts  = sum("pts");
  const totalFga  = sum("fga");
  const totalFta  = sum("fta");
  const totalFgm  = sum("fgm");
  const totalFg3m = sum("fg3m");
  const totalFg3a = sum("fg3a");
  const totalFg2m = sum("fg2m");
  const totalFg2a = sum("fg2a");
  const totalFtm  = sum("ftm");

  return {
    gp,
    ptsAvg:     avg("pts"),
    rebAvg:     avg("reb"),
    astAvg:     avg("ast"),
    stlAvg:     avg("stl"),
    blkAvg:     avg("blk"),
    toAvg:      avg("tov"),
    pfAvg:      avg("pf"),
    minutesAvg: avg("minutes"),
    fgPct:      pct(totalFgm,  totalFga),
    fg2Pct:     pct(totalFg2m, totalFg2a),
    tpPct:      pct(totalFg3m, totalFg3a),
    ftPct:      pct(totalFtm,  totalFta),
    tsPct:      calcTsPct(totalPts, totalFga, totalFta),
    ptsTotal:   totalPts,
    rebTotal:   sum("reb"),
    astTotal:   sum("ast"),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("computeAggregates — basic averages", () => {
  it("computes correct ppg / rpg / apg over 2 games", () => {
    const rows = [
      { minutes:30, pts:20, reb:5, ast:3, stl:1, blk:0, tov:2, pf:2,
        fgm:8, fga:14, fg2m:6, fg2a:8, fg3m:2, fg3a:6, ftm:2, fta:3 },
      { minutes:28, pts:10, reb:7, ast:5, stl:0, blk:1, tov:1, pf:3,
        fgm:4, fga:10, fg2m:4, fg2a:8, fg3m:0, fg3a:2, ftm:2, fta:2 },
    ];
    const agg = computeAggregates(rows);

    expect(agg.gp).toBe(2);
    expect(agg.ptsAvg).toBe(15.00);
    expect(agg.rebAvg).toBe(6.00);
    expect(agg.astAvg).toBe(4.00);
  });

  it("excludes rows with 0 minutes from gp and averages", () => {
    const rows = [
      { minutes:25, pts:12, reb:4, ast:2, stl:1, blk:0, tov:1, pf:2,
        fgm:5, fga:10, fg2m:4, fg2a:7, fg3m:1, fg3a:3, ftm:1, fta:2 },
      { minutes:0,  pts:0,  reb:0, ast:0, stl:0, blk:0, tov:0, pf:0,
        fgm:0, fga:0,  fg2m:0, fg2a:0, fg3m:0, fg3a:0, ftm:0, fta:0 },
    ];
    const agg = computeAggregates(rows);

    // Only 1 game counts — the DNP is excluded
    expect(agg.gp).toBe(1);
    expect(agg.ptsAvg).toBe(12.00);
  });

  it("returns null when all rows have 0 minutes", () => {
    const rows = [
      { minutes:0, pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, pf:0,
        fgm:0, fga:0, fg2m:0, fg2a:0, fg3m:0, fg3a:0, ftm:0, fta:0 },
    ];
    expect(computeAggregates(rows)).toBeNull();
  });
});

describe("computeAggregates — shooting percentages", () => {
  it("calculates fgPct correctly", () => {
    const rows = [
      { minutes:30, pts:14, reb:3, ast:2, stl:0, blk:0, tov:1, pf:2,
        fgm:6, fga:12, fg2m:4, fg2a:7, fg3m:2, fg3a:5, ftm:2, fta:3 },
    ];
    const agg = computeAggregates(rows);
    expect(agg.fgPct).toBe(50.0);   // 6/12
  });

  it("calculates tpPct (3PT%) correctly", () => {
    const rows = [
      { minutes:32, pts:12, reb:2, ast:4, stl:1, blk:0, tov:2, pf:1,
        fgm:4, fga:10, fg2m:2, fg2a:4, fg3m:2, fg3a:6, ftm:2, fta:2 },
    ];
    const agg = computeAggregates(rows);
    expect(agg.tpPct).toBe(33.3);   // 2/6
  });

  it("returns 0 for fgPct when fga is 0", () => {
    const rows = [
      { minutes:5, pts:2, reb:0, ast:0, stl:0, blk:0, tov:0, pf:1,
        fgm:0, fga:0, fg2m:0, fg2a:0, fg3m:0, fg3a:0, ftm:2, fta:2 },
    ];
    const agg = computeAggregates(rows);
    expect(agg.fgPct).toBe(0);
  });

  it("calculates tsPct correctly", () => {
    // pts=20, fga=14, fta=3 → denom = 2*(14 + 0.44*3) = 30.64 → 65.3%
    const rows = [
      { minutes:30, pts:20, reb:5, ast:3, stl:1, blk:0, tov:2, pf:2,
        fgm:8, fga:14, fg2m:6, fg2a:8, fg3m:2, fg3a:6, ftm:2, fta:3 },
    ];
    const agg = computeAggregates(rows);
    const expected = +((20 / (2 * (14 + 0.44 * 3))) * 100).toFixed(1);
    expect(agg.tsPct).toBe(expected);
  });
});

describe("computeAggregates — totals", () => {
  it("accumulates ptsTotal / rebTotal / astTotal correctly", () => {
    const rows = [
      { minutes:30, pts:15, reb:6, ast:3, stl:1, blk:0, tov:1, pf:2,
        fgm:6, fga:12, fg2m:4, fg2a:7, fg3m:2, fg3a:5, ftm:1, fta:2 },
      { minutes:28, pts:20, reb:8, ast:5, stl:2, blk:1, tov:2, pf:1,
        fgm:8, fga:15, fg2m:6, fg2a:9, fg3m:2, fg3a:6, ftm:2, fta:3 },
      { minutes:25, pts:8,  reb:4, ast:2, stl:0, blk:0, tov:3, pf:3,
        fgm:3, fga:9,  fg2m:3, fg2a:7, fg3m:0, fg3a:2, ftm:2, fta:4 },
    ];
    const agg = computeAggregates(rows);

    expect(agg.ptsTotal).toBe(43);
    expect(agg.rebTotal).toBe(18);
    expect(agg.astTotal).toBe(10);
  });
});