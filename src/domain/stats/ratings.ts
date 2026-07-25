// Team offensive/defensive rating: points per 100 possessions.
// This is our own metric. It currently reproduces the league's published
// Off./Def. Efficiency to within 0.05 rating points across every game that
// had one (see tests/fixtures/league-ratings.json), but it is defined here,
// not read from the source, and the constants below are ours to keep.
//
// poss = 0.96 * (FGA - OREB + TOV + 0.44*FTA) over the team's own totals.
// The bracket is the standard simplified possessions estimate (0.44 is the
// canonical free-throw-to-possession factor); the 0.96 is the known scaling
// that the simple estimate needs because it slightly overcounts. A free
// two-parameter fit against 38 games recovered exactly (0.96, 0.44), which is
// why the residual sits at the rating rounding floor rather than a fit error.
const POSS_FACTOR = 0.96;
const FTA_WEIGHT = 0.44;

export interface TeamRatingsInput {
  teamScore: number;
  opponentScore: number;
  // Team's own summed box score (PlayerGameStat sums for the AK side).
  fga: number;
  orb: number;
  tov: number;
  fta: number;
  // Sum of per-player PTS. A complete box has boxPts === teamScore.
  boxPts: number;
}

export interface TeamRatings {
  offRating: number;
  defRating: number;
  possessions: number;
}

export function teamPossessions(fga: number, orb: number, tov: number, fta: number): number {
  return POSS_FACTOR * (fga - orb + tov + FTA_WEIGHT * fta);
}

// Returns null when the rating is undefined rather than a bogus number:
// an incomplete/edited box (points do not reconcile) or a non-positive
// possession estimate would otherwise render as a wrong value or Infinity/NaN.
export function teamRatings(input: TeamRatingsInput): TeamRatings | null {
  if (input.boxPts !== input.teamScore) return null;
  const possessions = teamPossessions(input.fga, input.orb, input.tov, input.fta);
  if (possessions <= 0) return null;
  return {
    offRating: (100 * input.teamScore) / possessions,
    defRating: (100 * input.opponentScore) / possessions,
    possessions,
  };
}
