import { describe, it, expect } from "vitest";
import { computeAwards, type AggregateInput } from "@/domain/awards";

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
    expect(awards?.mvp?.playerId).toBe("a");
  });

  it("uses min(5, totalGames) so short seasons still produce MVP", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", effAvg: 10, gp: 3 }),
      row({ playerId: "b", playerName: "Bravo", effAvg: 15, gp: 3 }),
    ];
    const awards = computeAwards(rows, 3);
    expect(awards?.mvp?.playerId).toBe("b");
  });

  it("picks top scorer by ptsTotal", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", ptsTotal: 100 }),
      row({ playerId: "b", playerName: "Bravo", ptsTotal: 200 }),
    ];
    expect(computeAwards(rows, 10)?.scorer?.playerId).toBe("b");
  });

  it("picks rebounds leader by rebTotal", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", rebTotal: 100 }),
      row({ playerId: "b", playerName: "Bravo", rebTotal: 200 }),
    ];
    expect(computeAwards(rows, 10)?.rebounds?.playerId).toBe("b");
  });

  it("picks assists leader by astTotal", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", astTotal: 100 }),
      row({ playerId: "b", playerName: "Bravo", astTotal: 200 }),
    ];
    expect(computeAwards(rows, 10)?.assists?.playerId).toBe("b");
  });

  it("shooting excludes players below min(20, totalGames) fga", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", tsPct: 0.9, fgaTotal: 5 }),
      row({ playerId: "b", playerName: "Bravo", tsPct: 0.6, fgaTotal: 30 }),
    ];
    expect(computeAwards(rows, 10)?.shooting?.playerId).toBe("b");
  });

  it("shooting: short season uses min(20, totalGames)", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", tsPct: 0.9, fgaTotal: 10 }),
      row({ playerId: "b", playerName: "Bravo", tsPct: 0.6, fgaTotal: 8 }),
    ];
    expect(computeAwards(rows, 3)?.shooting?.playerId).toBe("a");
  });

  it("ties broken alphabetically by player name", () => {
    const rows = [
      row({ playerId: "b", playerName: "Bravo", ptsTotal: 100 }),
      row({ playerId: "a", playerName: "Alpha", ptsTotal: 100 }),
    ];
    expect(computeAwards(rows, 10)?.scorer?.playerId).toBe("a");
  });

  it("collapses multi-league rows by playerId (totals summed, effAvg + tsPct weighted by gp)", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", gp: 5, ptsTotal: 50, effAvg: 10, tsPct: 0.5, fgaTotal: 20 }),
      row({ playerId: "a", playerName: "Alpha", gp: 5, ptsTotal: 100, effAvg: 20, tsPct: 0.7, fgaTotal: 30 }),
    ];
    const awards = computeAwards(rows, 10);
    expect(awards?.mvp?.playerId).toBe("a");
    expect(awards?.scorer?.playerId).toBe("a");
  });

  it("returns outer null when every slot is null", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", gp: 1, ptsTotal: 0, rebTotal: 0, astTotal: 0, effAvg: 0, fgaTotal: 0 }),
    ];
    const awards = computeAwards(rows, 20);
    expect(awards?.mvp).toBeNull();
    expect(awards?.scorer?.playerId).toBe("a");
  });

  it("hides null slots but keeps non-null ones", () => {
    const rows = [
      row({ playerId: "a", playerName: "Alpha", gp: 2, effAvg: 5, fgaTotal: 3 }),
    ];
    const awards = computeAwards(rows, 20);
    expect(awards).not.toBeNull();
    expect(awards?.mvp).toBeNull();
    expect(awards?.shooting).toBeNull();
    expect(awards?.scorer?.playerId).toBe("a");
  });
});
