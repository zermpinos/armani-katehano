// @ts-nocheck
import { describe, it, expect } from "vitest";
import { initials } from "@/domain/players/format";

describe("initials", () => {
  it("returns the first letter for a single-word name", () => {
    expect(initials("Madonna")).toBe("M");
  });
  it("returns first and last initials for two words", () => {
    expect(initials("Petros Karras")).toBe("PK");
  });
  it("uses first and last word for three or more words", () => {
    expect(initials("Maria del Carmen")).toBe("MC");
  });
  it("uppercases lowercase input", () => {
    expect(initials("petros karras")).toBe("PK");
  });
  it("returns empty string for empty input", () => {
    expect(initials("")).toBe("");
  });
  it("returns empty string for whitespace only", () => {
    expect(initials("   ")).toBe("");
  });
});
