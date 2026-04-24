import { describe, it, expect } from "vitest";
import { classifyScrapedGame } from "@/server/services/import-classifier";

const Q = (home: number | null, away: number | null) => ({ home, away });

function makePayload(overrides: {
  teams?: any[];
  finalScore?: { home: number | null; away: number | null };
  quarterScores?: any[];
} = {}) {
  const quarterScores = overrides.quarterScores ?? [
    { quarter: "Q1", home: 20, away: 18 },
    { quarter: "Q2", home: 22, away: 19 },
    { quarter: "Q3", home: 18, away: 21 },
    { quarter: "Q4", home: 15, away: 17 },
  ];
  const finalScore = overrides.finalScore ?? { home: 75, away: 75 };
  const teams = overrides.teams ?? [
    { name: "ARMANI KATEHANO", players: [] },
    { name: "OPPONENT", players: [] },
  ];
  return { game: { homeTeam: "ARMANI KATEHANO", awayTeam: "OPPONENT", finalScore, quarterScores }, teams };
}

describe("classifyScrapedGame", () => {
  it("returns scheduled when teams array is empty (page not yet populated / 404-equivalent)", () => {
    const result = classifyScrapedGame(makePayload({ teams: [] }));
    expect(result.state).toBe("scheduled");
  });

  it("returns scheduled when no score data and no quarter scores", () => {
    const result = classifyScrapedGame(makePayload({
      finalScore: { home: null, away: null },
      quarterScores: [],
    }));
    expect(result.state).toBe("scheduled");
  });

  it("returns live when final score is null but quarter data exists", () => {
    const result = classifyScrapedGame(makePayload({
      finalScore: { home: null, away: null },
      quarterScores: [
        { quarter: "Q1", home: 20, away: 18 },
        { quarter: "Q2", home: 22, away: 19 },
      ],
    }));
    expect(result.state).toBe("live");
  });

  it("returns live when fewer than 4 quarters recorded", () => {
    const result = classifyScrapedGame(makePayload({
      quarterScores: [
        { quarter: "Q1", home: 20, away: 18 },
        { quarter: "Q2", home: 22, away: 19 },
        { quarter: "Q3", home: 18, away: 21 },
      ],
    }));
    expect(result.state).toBe("live");
  });

  it("returns live when Q4 score is null (partial Q4)", () => {
    const result = classifyScrapedGame(makePayload({
      quarterScores: [
        { quarter: "Q1", home: 20, away: 18 },
        { quarter: "Q2", home: 22, away: 19 },
        { quarter: "Q3", home: 18, away: 21 },
        { quarter: "Q4", home: null, away: null },
      ],
    }));
    expect(result.state).toBe("live");
  });

  it("returns live when quarter sum does not match final score (score mismatch)", () => {
    // quarterScores sum to 75-75, but finalScore says 80-75 -- still settling
    const result = classifyScrapedGame(makePayload({
      finalScore: { home: 80, away: 75 },
    }));
    expect(result.state).toBe("live");
    expect(result.reason).toMatch(/settling/);
  });

  it("returns final when all 4 quarters complete and sums match", () => {
    const result = classifyScrapedGame(makePayload());
    expect(result.state).toBe("final");
  });

  it("returns final even when AK team is not in teams (import-game handles that error)", () => {
    const result = classifyScrapedGame(makePayload({
      teams: [
        { name: "TEAM A", players: [] },
        { name: "TEAM B", players: [] },
      ],
    }));
    expect(result.state).toBe("final");
  });

  it("returns final for an away-win result", () => {
    const result = classifyScrapedGame(makePayload({
      finalScore: { home: 68, away: 82 },
      quarterScores: [
        { quarter: "Q1", home: 18, away: 22 },
        { quarter: "Q2", home: 16, away: 20 },
        { quarter: "Q3", home: 20, away: 21 },
        { quarter: "Q4", home: 14, away: 19 },
      ],
    }));
    expect(result.state).toBe("final");
  });
});
