// @ts-nocheck
/**
 * tests/stats.test.ts
 * Tests for lib/stats.prisma.ts -- computePlayerAggregates
 *
 * Uses a mock Prisma tx so no DB connection is needed.
 * We feed known box score rows and verify the computed aggregates.
 */
import { describe, it, expect, vi } from "vitest";
import { computePlayerAggregates } from "../lib/stats.prisma";

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("computePlayerAggregates -- basic averages", () => {
  it("computes correct ppg / rpg / apg over 2 games", () => {
    const rows = [
      { minutes:30, pts:20, reb:5, ast:3, stl:1, blk:0, tov:2, pf:2,
        fgm:8, fga:14, fg2m:6, fg2a:8, fg3m:2, fg3a:6, ftm:2, fta:3, orb:1, drb:4 },
      { minutes:28, pts:10, reb:7, ast:5, stl:0, blk:1, tov:1, pf:3,
        fgm:4, fga:10, fg2m:4, fg2a:8, fg3m:0, fg3a:2, ftm:2, fta:2, orb:2, drb:5 },
    ];
    const agg = computePlayerAggregates(rows);

    expect(agg.gp).toBe(2);
    expect(agg.ptsAvg).toBe(15.00);
    expect(agg.rebAvg).toBe(6.00);
    expect(agg.astAvg).toBe(4.00);
  });

  it("excludes rows with 0 minutes from gp and averages", () => {
    const rows = [
      { minutes:25, pts:12, reb:4, ast:2, stl:1, blk:0, tov:1, pf:2,
        fgm:5, fga:10, fg2m:4, fg2a:7, fg3m:1, fg3a:3, ftm:1, fta:2, orb:1, drb:3 },
      { minutes:0,  pts:0,  reb:0, ast:0, stl:0, blk:0, tov:0, pf:0,
        fgm:0, fga:0,  fg2m:0, fg2a:0, fg3m:0, fg3a:0, ftm:0, fta:0, orb:0, drb:0 },
    ];
    const agg = computePlayerAggregates(rows);

    expect(agg.gp).toBe(1);
    expect(agg.ptsAvg).toBe(12.00);
  });

  it("returns null when all rows have 0 minutes", () => {
    const rows = [
      { minutes:0, pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, pf:0,
        fgm:0, fga:0, fg2m:0, fg2a:0, fg3m:0, fg3a:0, ftm:0, fta:0, orb:0, drb:0 },
    ];
    expect(computePlayerAggregates(rows)).toBeNull();
  });
});

describe("computePlayerAggregates -- shooting percentages", () => {
  it("calculates fgPct correctly", () => {
    const rows = [
      { minutes:30, pts:14, reb:3, ast:2, stl:0, blk:0, tov:1, pf:2,
        fgm:6, fga:12, fg2m:4, fg2a:7, fg3m:2, fg3a:5, ftm:2, fta:3, orb:0, drb:3 },
    ];
    const agg = computePlayerAggregates(rows);
    expect(agg.fgPct).toBe(50.0);   // 6/12
  });

  it("calculates fg3Pct (3PT%) correctly", () => {
    const rows = [
      { minutes:32, pts:12, reb:2, ast:4, stl:1, blk:0, tov:2, pf:1,
        fgm:4, fga:10, fg2m:2, fg2a:4, fg3m:2, fg3a:6, ftm:2, fta:2, orb:0, drb:2 },
    ];
    const agg = computePlayerAggregates(rows);
    expect(agg.fg3Pct).toBe(33.3);  // 2/6
  });

  it("returns 0 for fgPct when fga is 0", () => {
    const rows = [
      { minutes:5, pts:2, reb:0, ast:0, stl:0, blk:0, tov:0, pf:1,
        fgm:0, fga:0, fg2m:0, fg2a:0, fg3m:0, fg3a:0, ftm:2, fta:2, orb:0, drb:0 },
    ];
    const agg = computePlayerAggregates(rows);
    expect(agg.fgPct).toBe(0);
  });

  it("returns 0 for ftPct when fta is 0", () => {
    const rows = [
      { minutes:20, pts:10, reb:3, ast:1, stl:0, blk:0, tov:1, pf:1,
        fgm:5, fga:10, fg2m:5, fg2a:10, fg3m:0, fg3a:0, ftm:0, fta:0, orb:1, drb:2 },
    ];
    const agg = computePlayerAggregates(rows);
    expect(agg.ftPct).toBe(0);
  });

  it("calculates tsPct correctly", () => {
    // pts=20, fga=14, fta=3 -> denom = 2*(14 + 0.44*3) = 30.64 -> 65.3%
    const rows = [
      { minutes:30, pts:20, reb:5, ast:3, stl:1, blk:0, tov:2, pf:2,
        fgm:8, fga:14, fg2m:6, fg2a:8, fg3m:2, fg3a:6, ftm:2, fta:3, orb:1, drb:4 },
    ];
    const agg = computePlayerAggregates(rows);
    const expected = +((20 / (2 * (14 + 0.44 * 3))) * 100).toFixed(1);
    expect(agg.tsPct).toBe(expected);
  });
});

describe("computePlayerAggregates -- totals", () => {
  it("accumulates ptsTotal / rebTotal / astTotal correctly", () => {
    const rows = [
      { minutes:30, pts:15, reb:6, ast:3, stl:1, blk:0, tov:1, pf:2,
        fgm:6, fga:12, fg2m:4, fg2a:7, fg3m:2, fg3a:5, ftm:1, fta:2, orb:2, drb:4 },
      { minutes:28, pts:20, reb:8, ast:5, stl:2, blk:1, tov:2, pf:1,
        fgm:8, fga:15, fg2m:6, fg2a:9, fg3m:2, fg3a:6, ftm:2, fta:3, orb:3, drb:5 },
      { minutes:25, pts:8,  reb:4, ast:2, stl:0, blk:0, tov:3, pf:3,
        fgm:3, fga:9,  fg2m:3, fg2a:7, fg3m:0, fg3a:2, ftm:2, fta:4, orb:1, drb:3 },
    ];
    const agg = computePlayerAggregates(rows);

    expect(agg.ptsTotal).toBe(43);
    expect(agg.rebTotal).toBe(18);
    expect(agg.astTotal).toBe(10);
  });

  it("accumulates fgmTotal / fgaTotal correctly", () => {
    const rows = [
      { minutes:30, pts:14, reb:3, ast:2, stl:1, blk:0, tov:1, pf:2,
        fgm:6, fga:12, fg2m:4, fg2a:7, fg3m:2, fg3a:5, ftm:2, fta:3, orb:0, drb:3 },
      { minutes:28, pts:10, reb:5, ast:3, stl:0, blk:1, tov:2, pf:1,
        fgm:4, fga:10, fg2m:3, fg2a:7, fg3m:1, fg3a:3, ftm:2, fta:2, orb:1, drb:4 },
    ];
    const agg = computePlayerAggregates(rows);

    expect(agg.fgmTotal).toBe(10);   // 6+4
    expect(agg.fgaTotal).toBe(22);   // 12+10
  });

  it("accumulates stlTotal correctly, DNPs excluded", () => {
    const rows = [
      { minutes:30, pts:15, reb:4, ast:3, stl:3, blk:1, tov:1, pf:2,
        fgm:6, fga:12, fg2m:4, fg2a:7, fg3m:2, fg3a:5, ftm:1, fta:2, orb:1, drb:3 },
      { minutes:0,  pts:0,  reb:0, ast:0, stl:5, blk:0, tov:0, pf:0,
        fgm:0, fga:0,  fg2m:0, fg2a:0, fg3m:0, fg3a:0, ftm:0, fta:0, orb:0, drb:0 },
      { minutes:25, pts:10, reb:3, ast:2, stl:2, blk:0, tov:2, pf:3,
        fgm:4, fga:9,  fg2m:4, fg2a:9, fg3m:0, fg3a:0, ftm:2, fta:4, orb:0, drb:3 },
    ];
    const agg = computePlayerAggregates(rows);

    // DNP row (stl:5) must be excluded -- only the two active rows count
    expect(agg.stlTotal).toBe(5);    // 3+2
    expect(agg.gp).toBe(2);
  });
});

describe("computePlayerAggregates -- rebounds breakdown", () => {
  it("computes orbAvg and drbAvg correctly", () => {
    const rows = [
      { minutes:32, pts:18, reb:8, ast:2, stl:1, blk:1, tov:2, pf:2,
        fgm:7, fga:14, fg2m:5, fg2a:8, fg3m:2, fg3a:6, ftm:2, fta:2, orb:3, drb:5 },
      { minutes:28, pts:12, reb:6, ast:3, stl:0, blk:0, tov:1, pf:1,
        fgm:5, fga:11, fg2m:5, fg2a:11, fg3m:0, fg3a:0, ftm:2, fta:3, orb:1, drb:5 },
    ];
    const agg = computePlayerAggregates(rows);

    expect(agg.orbAvg).toBe(2.00);   // (3+1)/2
    expect(agg.drbAvg).toBe(5.00);   // (5+5)/2
  });
});

describe("computePlayerAggregates -- efficiency", () => {
  it("computes effAvg correctly across multiple games", () => {
    // EFF = pts + reb + ast + stl + blk - (fga-fgm) - (fta-ftm) - tov
    // game1: 20+5+3+1+0 - (14-8) - (3-2) - 2 = 29-6-1-2 = 20
    // game2: 10+7+5+0+1 - (10-4) - (2-2) - 1 = 23-6-0-1 = 16
    // effAvg = (20+16)/2 = 18.00
    const rows = [
      { minutes:30, pts:20, reb:5, ast:3, stl:1, blk:0, tov:2, pf:2,
        fgm:8, fga:14, fg2m:6, fg2a:8, fg3m:2, fg3a:6, ftm:2, fta:3, orb:1, drb:4 },
      { minutes:28, pts:10, reb:7, ast:5, stl:0, blk:1, tov:1, pf:3,
        fgm:4, fga:10, fg2m:4, fg2a:8, fg3m:0, fg3a:2, ftm:2, fta:2, orb:2, drb:5 },
    ];
    const agg = computePlayerAggregates(rows);
    expect(agg.effAvg).toBe(18.00);
  });
});
