import { describe, it, expect } from "vitest";
import { teamRatings, type TeamRatingsInput } from "@/domain/stats/ratings";
import leagueRatings from "../../../fixtures/league-ratings.json";

// Oracle: the league's published Off./Def. Efficiency for every rated game,
// paired with the source-side box score that produced it. Preserved here
// because the Game.offRating/defRating columns are being dropped; this is the
// only ground truth left once they are gone. Dragons 2026-02-21 uses the fresh
// scraped value (100.5/95.3), not the stale DB value that the source superseded.
interface Row extends TeamRatingsInput {
  gameId: string;
  date: string;
  opponent: string;
  offRating: number;
  defRating: number;
}

const rows = leagueRatings as Row[];
// Observed max residual across the fixture is 0.0498. The source ratings are
// quantized to one decimal, which is a +/-0.05 floor on its own; 0.06 clears
// both that floor and the observed residual without being loose enough to hide
// a real formula break.
const TOL = 0.06;

describe("teamRatings reproduces the league's published ratings", () => {
  it("covers every rated game", () => {
    expect(rows).toHaveLength(39);
  });

  for (const r of rows) {
    it(`${r.date} vs ${r.opponent}`, () => {
      const got = teamRatings(r);
      expect(got).not.toBeNull();
      expect(Math.abs(got!.offRating - r.offRating)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(got!.defRating - r.defRating)).toBeLessThanOrEqual(TOL);
    });
  }
});

describe("teamRatings guards degenerate inputs", () => {
  const base: TeamRatingsInput = {
    teamScore: 60, opponentScore: 55, fga: 60, orb: 10, tov: 8, fta: 15, boxPts: 60,
  };

  it("returns null when the box is incomplete (boxPts !== teamScore)", () => {
    expect(teamRatings({ ...base, boxPts: 58 })).toBeNull();
  });

  it("returns null when possessions are non-positive", () => {
    expect(teamRatings({ teamScore: 0, opponentScore: 0, fga: 0, orb: 0, tov: 0, fta: 0, boxPts: 0 })).toBeNull();
  });
});
