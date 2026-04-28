import "@/server/_internal/node-only";
export type GameState = "scheduled" | "live" | "final";

export interface ClassifyResult {
  state: GameState;
  reason: string;
}

export function classifyScrapedGame(data: any): ClassifyResult {
  const { game, teams } = data ?? {};

  if (!Array.isArray(teams) || teams.length === 0)
    return { state: "scheduled", reason: "no teams in box score" };

  const { finalScore, quarterScores } = game ?? {};

  if (finalScore?.home === null || finalScore?.away === null ||
      finalScore?.home === undefined || finalScore?.away === undefined) {
    if (Array.isArray(quarterScores) && quarterScores.length > 0)
      return { state: "live", reason: "quarter scores present but final score missing" };
    return { state: "scheduled", reason: "no score data" };
  }

  if (!Array.isArray(quarterScores) || quarterScores.length < 4)
    return { state: "live", reason: "fewer than 4 quarters recorded" };

  for (const q of quarterScores) {
    if (q.home === null || q.away === null || q.home === undefined || q.away === undefined)
      return { state: "live", reason: "partial quarter scores -- Q4 not yet complete" };
  }

  // Guard against a race where the page renders a settled finalScore
  // before the quarter totals are updated (or vice versa).
  const homeSum = quarterScores.reduce((acc: number, q: any) => acc + Number(q.home), 0);
  const awaySum = quarterScores.reduce((acc: number, q: any) => acc + Number(q.away), 0);

  // Quarter sum < final score is valid (overtime points not in quarters array).
  // Quarter sum > final score means the page hasn't settled yet.
  if (homeSum > Number(finalScore.home) || awaySum > Number(finalScore.away))
    return { state: "live", reason: "quarter sum exceeds final score -- page still settling" };

  return { state: "final", reason: "all 4 quarters complete with consistent final score" };
}
