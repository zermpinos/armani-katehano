// @ts-nocheck
import { describe, it, expect } from "vitest";
import { phaseLabel } from "@/domain/games/phase";

describe("phaseLabel", () => {
  it("returns 'Regular Season' for 'regular'", () => {
    expect(phaseLabel("regular")).toBe("Regular Season");
  });

  it("returns 'Playoffs · Quarterfinal' for 'quarterfinal'", () => {
    expect(phaseLabel("quarterfinal")).toBe("Playoffs · Quarterfinal");
  });

  it("returns 'Playoffs · Semifinal' for 'semifinal'", () => {
    expect(phaseLabel("semifinal")).toBe("Playoffs · Semifinal");
  });

  it("returns 'Playoffs · Final' for 'final'", () => {
    expect(phaseLabel("final")).toBe("Playoffs · Final");
  });

  it("falls back to 'Regular Season' for unknown input", () => {
    expect(phaseLabel("unknown")).toBe("Regular Season");
  });

  it("falls back to 'Regular Season' for empty string", () => {
    expect(phaseLabel("")).toBe("Regular Season");
  });
});
