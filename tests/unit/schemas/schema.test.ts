// @ts-nocheck
/**
 * tests/schema.test.js
 * Tests for the BoxScoreRowSchema Zod validations in pages/api/admin/games.js
 *
 * These cross-field refinements are the last line of defence before bad data
 * reaches the DB — they must all work correctly.
 */
import { describe, it, expect } from "vitest";
import { z }                    from "zod";
import { BoxScoreRowSchema }    from "@/schemas/box-score";

// ─── Valid base row ───────────────────────────────────────────────────────────
const VALID_ROW = {
  playerId: "clxxxxxxxxxxxxxxxxxxxxxx",  // 26 chars, starts with 'c' — valid CUID shape
  minutes: 28, pts: 14, reb: 5,
  orb: 2, drb: 3,
  ast: 3, stl: 1, blk: 0, tov: 2, pf: 2,
  fgm: 6, fga: 12,
  fg2m: 4, fg2a: 7,
  fg3m: 2, fg3a: 5,
  ftm: 2, fta: 3,
};

function valid(overrides = {}) {
  return BoxScoreRowSchema.safeParse({ ...VALID_ROW, ...overrides });
}

// ─── z.string().cuid() validator tests ───────────────────────────────────────

const cuidSchema = z.string().cuid();

describe("z.string().cuid() validator", () => {
  it("accepts a valid CUID", () => {
    expect(cuidSchema.safeParse("clxxxxxxxxxxxxxxxxxxxxxx").success).toBe(true);
  });

  it("rejects a UUID", () => {
    expect(cuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(cuidSchema.safeParse("").success).toBe(false);
  });

  it("rejects a string that doesn't start with c", () => {
    expect(cuidSchema.safeParse("alxxxxxxxxxxxxxxxxxxxxxx").success).toBe(false);
  });
});

// ─── BoxScoreRowSchema tests ──────────────────────────────────────────────────

describe("BoxScoreRowSchema — valid row", () => {
  it("accepts a fully valid row", () => {
    expect(valid().success).toBe(true);
  });

  it("accepts a DNP row with all zeros", () => {
    const result = BoxScoreRowSchema.safeParse({
      playerId: "clxxxxxxxxxxxxxxxxxxxxxx",
      minutes:0, pts:0, reb:0, orb:0, drb:0,
      ast:0, stl:0, blk:0, tov:0, pf:0,
      fgm:0, fga:0, fg2m:0, fg2a:0,
      fg3m:0, fg3a:0, ftm:0, fta:0,
    });
    expect(result.success).toBe(true);
  });
});

describe("BoxScoreRowSchema — made/attempted refinements", () => {
  it("rejects fgm > fga", () => {
    const r = valid({ fgm: 8, fga: 6 });
    expect(r.success).toBe(false);
    expect(r.error.flatten().formErrors).toContain("fgm cannot exceed fga");
  });

  it("rejects fg2m > fg2a", () => {
    const r = valid({ fg2m: 6, fg2a: 4 });
    expect(r.success).toBe(false);
    expect(r.error.flatten().formErrors).toContain("fg2m cannot exceed fg2a");
  });

  it("rejects fg3m > fg3a", () => {
    const r = valid({ fg3m: 4, fg3a: 2 });
    expect(r.success).toBe(false);
    expect(r.error.flatten().formErrors).toContain("fg3m cannot exceed fg3a");
  });

  it("rejects ftm > fta", () => {
    const r = valid({ ftm: 4, fta: 2 });
    expect(r.success).toBe(false);
    expect(r.error.flatten().formErrors).toContain("ftm cannot exceed fta");
  });
});

describe("BoxScoreRowSchema — fg2m + fg3m = fgm refinement", () => {
  it("rejects fg2m + fg3m != fgm", () => {
    const r = valid({ fgm: 6, fg2m: 3, fg3m: 2 });
    expect(r.success).toBe(false);
    expect(r.error.flatten().formErrors).toContain("fg2m + fg3m must equal fgm");
  });

  it("accepts fg2m + fg3m = fgm exactly", () => {
    expect(valid({ fgm: 6, fg2m: 4, fg3m: 2 }).success).toBe(true);
  });
});

describe("BoxScoreRowSchema — rebound refinement", () => {
  it("rejects orb + drb != reb", () => {
    const r = valid({ reb: 5, orb: 3, drb: 4 });
    expect(r.success).toBe(false);
    expect(r.error.flatten().formErrors).toContain("orb+drb must equal reb");
  });

  it("accepts orb + drb = reb exactly", () => {
    expect(valid({ reb: 5, orb: 2, drb: 3 }).success).toBe(true);
  });

  it("rejects orb + drb = reb + 1", () => {
    expect(valid({ reb: 5, orb: 3, drb: 3 }).success).toBe(false);
  });
});
