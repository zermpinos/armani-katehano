/**
 * tests/validators.test.js
 * Additional tests for lib/validators -- coercion, boundary values, ScrapedGameSchema.
 * The refinement tests for BoxScoreRowSchema already live in tests/schema.test.js.
 */
import { describe, it, expect } from "vitest";
import { BoxScoreRowSchema, ScrapedGameSchema } from "../lib/validators";

const BASE_ROW = {
  playerId: "clxxxxxxxxxxxxxxxxxxxxxx",
  minutes: 0, pts: 0, reb: 0, orb: 0, drb: 0, ast: 0,
  stl: 0, blk: 0, tov: 0, pf: 0,
  fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0,
};
const valid = (o = {}) => BoxScoreRowSchema.safeParse({ ...BASE_ROW, ...o });

// ─── BoxScoreRowSchema -- coercion from strings ────────────────────────────────

describe("BoxScoreRowSchema -- coercion", () => {
  it("coerces string values to numbers", () => {
    const result = BoxScoreRowSchema.safeParse({
      playerId: "clxxxxxxxxxxxxxxxxxxxxxx",
      minutes:"28", pts:"14", reb:"5", orb:"2", drb:"3",
      ast:"3", stl:"1", blk:"0", tov:"2", pf:"2",
      fgm:"6", fga:"12", fg2m:"4", fg2a:"7", fg3m:"2", fg3a:"5",
      ftm:"2", fta:"3",
    });
    expect(result.success).toBe(true);
    expect(typeof result.data.pts).toBe("number");
    expect(result.data.pts).toBe(14);
    expect(result.data.minutes).toBe(28);
  });
});

// ─── BoxScoreRowSchema -- boundary values ─────────────────────────────────────

describe("BoxScoreRowSchema -- boundary values", () => {
  it("accepts minutes = 60 (maximum)", () => {
    expect(valid({ minutes: 60 }).success).toBe(true);
  });

  it("rejects minutes > 60", () => {
    expect(valid({ minutes: 61 }).success).toBe(false);
  });

  it("accepts pts = 200 (maximum)", () => {
    expect(valid({ pts: 200 }).success).toBe(true);
  });

  it("rejects pts > 200", () => {
    expect(valid({ pts: 201 }).success).toBe(false);
  });

  it("accepts pf = 6 (maximum)", () => {
    expect(valid({ pf: 6 }).success).toBe(true);
  });

  it("rejects pf > 6", () => {
    expect(valid({ pf: 7 }).success).toBe(false);
  });

  it("rejects negative pts", () => {
    expect(valid({ pts: -1 }).success).toBe(false);
  });

  it("rejects negative minutes", () => {
    expect(valid({ minutes: -1 }).success).toBe(false);
  });

  it("rejects negative stl", () => {
    expect(valid({ stl: -1 }).success).toBe(false);
  });
});

// ─── ScrapedGameSchema ────────────────────────────────────────────────────────

const VALID_GAME = {
  url: "https://example.com/game/1",
  game: { homeTeam: "AK", awayTeam: "OPP", finalScore: { home: 80, away: 70 } },
  teams: [{ name: "AK", players: [] }],
};

describe("ScrapedGameSchema", () => {
  it("accepts a minimal valid payload", () => {
    expect(ScrapedGameSchema.safeParse(VALID_GAME).success).toBe(true);
  });

  it("rejects payload with missing url", () => {
    const { url: _url, ...noUrl } = VALID_GAME;
    expect(ScrapedGameSchema.safeParse(noUrl).success).toBe(false);
  });

  it("rejects payload with invalid (non-URL) url", () => {
    expect(ScrapedGameSchema.safeParse({ ...VALID_GAME, url: "not-a-url" }).success).toBe(false);
  });

  it("rejects payload with > 4 teams", () => {
    const teams = Array(5).fill({ name: "T", players: [] });
    expect(ScrapedGameSchema.safeParse({ ...VALID_GAME, teams }).success).toBe(false);
  });

  it("rejects payload with 0 teams", () => {
    expect(ScrapedGameSchema.safeParse({ ...VALID_GAME, teams: [] }).success).toBe(false);
  });

  it("accepts null finalScore values (score may not be posted yet)", () => {
    const payload = {
      ...VALID_GAME,
      game: { homeTeam: "AK", awayTeam: "OPP", finalScore: { home: null, away: null } },
    };
    expect(ScrapedGameSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects payload missing game.homeTeam", () => {
    const payload = {
      ...VALID_GAME,
      game: { awayTeam: "OPP", finalScore: { home: 80, away: 70 } },
    };
    expect(ScrapedGameSchema.safeParse(payload).success).toBe(false);
  });
});
