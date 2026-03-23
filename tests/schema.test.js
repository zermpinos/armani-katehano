/**
 * tests/schema.test.js
 * Tests for the BoxScoreRowSchema Zod validations in pages/api/admin/games.js
 *
 * These cross-field refinements are the last line of defence before bad data
 * reaches the DB -- they must all work correctly.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Inline the schema (copy from pages/api/admin/games.js) ───────────────────
// Keeping it here avoids importing Next.js API route internals into tests.

const BoxScoreRowSchema = z.object({
  playerId:  z.string().cuid(),
  minutes:   z.coerce.number().int().min(0).max(60),
  pts:       z.coerce.number().int().min(0).max(200),
  reb:       z.coerce.number().int().min(0).max(100),
  orb:       z.coerce.number().int().min(0).max(50).default(0),
  drb:       z.coerce.number().int().min(0).max(50).default(0),
  ast:       z.coerce.number().int().min(0).max(100),
  stl:       z.coerce.number().int().min(0).max(50),
  blk:       z.coerce.number().int().min(0).max(50),
  tov:       z.coerce.number().int().min(0).max(50),
  pf:        z.coerce.number().int().min(0).max(6),
  fgm:       z.coerce.number().int().min(0).max(100),
  fga:       z.coerce.number().int().min(0).max(100),
  fg2m:      z.coerce.number().int().min(0).max(100),
  fg2a:      z.coerce.number().int().min(0).max(100),
  fg3m:      z.coerce.number().int().min(0).max(50),
  fg3a:      z.coerce.number().int().min(0).max(50),
  ftm:       z.coerce.number().int().min(0).max(50),
  fta:       z.coerce.number().int().min(0).max(50),
})
  .refine(r => r.fgm  <= r.fga,             { message: "fgm cannot exceed fga" })
  .refine(r => r.fg2m <= r.fg2a,            { message: "fg2m cannot exceed fg2a" })
  .refine(r => r.fg3m <= r.fg3a,            { message: "fg3m cannot exceed fg3a" })
  .refine(r => r.ftm  <= r.fta,             { message: "ftm cannot exceed fta" })
  .refine(r => r.fg2m + r.fg3m === r.fgm,   { message: "fg2m + fg3m must equal fgm" })
  .refine(r => r.fg3m <= r.fgm,             { message: "fg3m cannot exceed fgm" })
  .refine(r => r.orb  + r.drb <= r.reb + 1, { message: "orb+drb cannot exceed reb" });

// ─── Valid base row to build tests from ───────────────────────────────────────
const VALID_ROW = {
  playerId: "clxxxxxxxxxxxxxxxxxxxxxx",  // valid cuid shape
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

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("BoxScoreRowSchema -- valid row", () => {
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

describe("BoxScoreRowSchema -- made/attempted refinements", () => {
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

describe("BoxScoreRowSchema -- fg2m + fg3m = fgm refinement", () => {
  it("rejects fg2m + fg3m != fgm", () => {
    // fg2m=3 + fg3m=2 = 5, but fgm=6
    const r = valid({ fgm: 6, fg2m: 3, fg3m: 2 });
    expect(r.success).toBe(false);
    expect(r.error.flatten().formErrors).toContain("fg2m + fg3m must equal fgm");
  });

  it("accepts fg2m + fg3m = fgm exactly", () => {
    // fg2m=4 + fg3m=2 = 6 = fgm
    expect(valid({ fgm: 6, fg2m: 4, fg3m: 2 }).success).toBe(true);
  });
});

describe("BoxScoreRowSchema -- rebound refinement", () => {
  it("rejects orb + drb > reb + 1", () => {
    // orb=3 + drb=4 = 7, but reb=5 -> 7 > 6
    const r = valid({ reb: 5, orb: 3, drb: 4 });
    expect(r.success).toBe(false);
    expect(r.error.flatten().formErrors).toContain("orb+drb cannot exceed reb");
  });

  it("accepts orb + drb = reb exactly", () => {
    expect(valid({ reb: 5, orb: 2, drb: 3 }).success).toBe(true);
  });

  it("accepts orb + drb = reb + 1 (rounding tolerance)", () => {
    expect(valid({ reb: 5, orb: 3, drb: 3 }).success).toBe(true);
  });
});