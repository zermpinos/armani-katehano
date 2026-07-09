import { describe, it, expect } from "vitest";
import { computeAwards, type AggregateInput, shortName, formatAwardValue } from "@/domain/awards";

function row(overrides: Partial<AggregateInput>): AggregateInput {
  return {
    playerId: "p1",
    playerName: "Alpha Player",
    playerSlug: "alpha-player",
    playerNumber: 1,
    gp: 10,
    ptsTotal: 100,
    rebTotal: 50,
    astTotal: 30,
    effAvg: 15,
    tsPct: 0.55,
    fgaTotal: 80,
    ...overrides,
  };
}

describe("computeAwards", () => {
  it("returns null for empty input", () => {
    expect(computeAwards([], 10)).toBeNull();
  });

  it("picks MVP by highest effAvg with min(5, totalGames) gp", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", effAvg: 20, gp: 10 }),
      row({ playerId: "b", playerName: "Bravo", effAvg: 25, gp: 3 }),
      row({ playerId: "c", playerName: "Charlie", effAvg: 18, gp: 8 }),
    ];
    const awards = computeAwards(rows, 20);
    expect(awards?.mvp[0]?.playerId).toBe("a");
  });

  it("uses min(5, totalGames) so short seasons still produce MVP", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", effAvg: 10, gp: 3 }),
      row({ playerId: "b", playerName: "Bravo", effAvg: 15, gp: 3 }),
    ];
    const awards = computeAwards(rows, 3);
    expect(awards?.mvp[0]?.playerId).toBe("b");
  });

  it("picks top scorer by ptsTotal", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", ptsTotal: 100 }),
      row({ playerId: "b", playerName: "Bravo", ptsTotal: 200 }),
    ];
    expect(computeAwards(rows, 10)?.scorer[0]?.playerId).toBe("b");
  });

  it("picks rebounds leader by rebTotal", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", rebTotal: 100 }),
      row({ playerId: "b", playerName: "Bravo", rebTotal: 200 }),
    ];
    expect(computeAwards(rows, 10)?.rebounds[0]?.playerId).toBe("b");
  });

  it("picks assists leader by astTotal", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", astTotal: 100 }),
      row({ playerId: "b", playerName: "Bravo", astTotal: 200 }),
    ];
    expect(computeAwards(rows, 10)?.assists[0]?.playerId).toBe("b");
  });

  it("shooting excludes players below min(20, totalGames) fga", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", tsPct: 0.9, fgaTotal: 5 }),
      row({ playerId: "b", playerName: "Bravo", tsPct: 0.6, fgaTotal: 30 }),
    ];
    expect(computeAwards(rows, 10)?.shooting[0]?.playerId).toBe("b");
  });

  it("shooting: short season uses min(20, totalGames)", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", tsPct: 0.9, fgaTotal: 10 }),
      row({ playerId: "b", playerName: "Bravo", tsPct: 0.6, fgaTotal: 8 }),
    ];
    expect(computeAwards(rows, 3)?.shooting[0]?.playerId).toBe("a");
  });

  it("ties broken alphabetically by player name", () => {
    const rows = [
      row({ playerId: "b", playerName: "Bravo", ptsTotal: 100 }),
      row({ playerId: "a", playerName: "Alpha", ptsTotal: 100 }),
    ];
    expect(computeAwards(rows, 10)?.scorer[0]?.playerId).toBe("a");
  });

  it("collapses multi-league rows by playerId (totals summed, effAvg + tsPct weighted by gp)", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", gp: 5, ptsTotal: 50, effAvg: 10, tsPct: 0.5, fgaTotal: 20 }),
      row({ playerId: "a", playerName: "Alpha", gp: 5, ptsTotal: 100, effAvg: 20, tsPct: 0.7, fgaTotal: 30 }),
    ];
    const awards = computeAwards(rows, 10);
    expect(awards?.mvp[0]?.playerId).toBe("a");
    expect(awards?.scorer[0]?.playerId).toBe("a");
  });

  it("counting-stat leaders have no eligibility floor (zero stats still crown)", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", gp: 1, ptsTotal: 0, rebTotal: 0, astTotal: 0, effAvg: 0, fgaTotal: 0 }),
    ];
    const awards = computeAwards(rows, 20);
    expect(awards?.mvp).toEqual([]);
    expect(awards?.scorer[0]?.playerId).toBe("a");
    expect(awards?.rebounds[0]?.playerId).toBe("a");
    expect(awards?.assists[0]?.playerId).toBe("a");
  });

  it("hides null slots but keeps non-null ones", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", gp: 2, effAvg: 5, fgaTotal: 3 }),
    ];
    const awards = computeAwards(rows, 20);
    expect(awards).not.toBeNull();
    expect(awards?.mvp).toEqual([]);
    expect(awards?.shooting).toEqual([]);
    expect(awards?.scorer[0]?.playerId).toBe("a");
  });

  it("returns top 3 in each counting-stat slot", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha",   ptsTotal: 100 }),
      row({ playerId: "b", playerName: "Bravo",   ptsTotal: 300 }),
      row({ playerId: "c", playerName: "Charlie", ptsTotal: 200 }),
      row({ playerId: "d", playerName: "Delta",   ptsTotal: 150 }),
    ];
    const awards = computeAwards(rows, 20);
    expect(awards?.scorer.map((r) => r.playerId)).toEqual(["b", "c", "d"]);
  });

  it("returns fewer than 3 when fewer players are eligible", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", gp: 10, effAvg: 15 }),
      row({ playerId: "b", playerName: "Bravo", gp: 10, effAvg: 20 }),
    ];
    const awards = computeAwards(rows, 20);
    expect(awards?.mvp).toHaveLength(2);
    expect(awards?.mvp[0].playerId).toBe("b");
    expect(awards?.mvp[1].playerId).toBe("a");
  });

  it("returns empty array when nobody meets eligibility floor", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", gp: 2, effAvg: 20 }),
    ];
    const awards = computeAwards(rows, 20);
    expect(awards?.mvp).toEqual([]);
  });

  it("breaks ties alphabetically within the podium", () => {
    const rows = [
      row({ playerId: "c", playerName: "Charlie", ptsTotal: 100 }),
      row({ playerId: "a", playerName: "Alpha",   ptsTotal: 100 }),
      row({ playerId: "b", playerName: "Bravo",   ptsTotal: 100 }),
    ];
    const awards = computeAwards(rows, 20);
    expect(awards?.scorer.map((r) => r.playerId)).toEqual(["a", "b", "c"]);
  });

  it("respects shooting fga floor for all podium spots", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", tsPct: 0.9, fgaTotal: 5 }),
      row({ playerId: "b", playerName: "Bravo", tsPct: 0.8, fgaTotal: 30 }),
      row({ playerId: "c", playerName: "Charlie", tsPct: 0.7, fgaTotal: 25 }),
    ];
    const awards = computeAwards(rows, 20);
    expect(awards?.shooting.map((r) => r.playerId)).toEqual(["b", "c"]);
  });
});

describe("shortName", () => {
  it("returns first initial + dot + space + last name", () => {
    expect(shortName("Panagiotis Zermpinos")).toBe("P. Zermpinos");
  });

  it("passes single-word names through unchanged", () => {
    expect(shortName("Zermpinos")).toBe("Zermpinos");
  });

  it("takes only the first token as the initial, keeps the rest verbatim", () => {
    expect(shortName("Anna Maria Kollia")).toBe("A. Maria Kollia");
  });

  it("collapses extra whitespace between first and last", () => {
    expect(shortName("Alpha   Beta")).toBe("A. Beta");
  });
});

describe("formatAwardValue", () => {
  it("MVP formats effAvg to one decimal", () => {
    expect(formatAwardValue("mvp", 15.288)).toBe("15.3");
  });

  it("scorer rounds ptsTotal to integer", () => {
    expect(formatAwardValue("scorer", 200)).toBe("200");
    expect(formatAwardValue("scorer", 200.7)).toBe("201");
  });

  it("rebounds rounds rebTotal to integer", () => {
    expect(formatAwardValue("rebounds", 50)).toBe("50");
  });

  it("assists rounds astTotal to integer", () => {
    expect(formatAwardValue("assists", 30)).toBe("30");
  });

  it("shooting renders tsPct as one-decimal percent", () => {
    expect(formatAwardValue("shooting", 0.567)).toBe("56.7%");
    expect(formatAwardValue("shooting", 0.5)).toBe("50.0%");
  });
});
