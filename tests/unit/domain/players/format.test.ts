// @ts-nocheck
import { describe, it, expect } from "vitest";
import { initials, surnameKey } from "@/domain/players/format";

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

describe("surnameKey", () => {
  it.each([
    ["ΠΑΠΑΣΠΥΡΟΥ", "Papaspyrou"],
    ["ΧΡΙΣΤΟΦΙΛΟΠΟΥΛΟΣ", "Christofilopoulos"],
    ["ΨΥΛΛΑΣ", "Psillas"],
    ["ΑΛΕΒΙΖΟΣ", "Alevizos"],
    ["ΖΕΡΜΠΙΝΟΣ", "Zermpinos"],
    ["ΚΟΥΓΙΑΝΟΣ", "Kougianos"],
    ["ΤΣΙΑΡΔΑΚΑΣ", "Tsiardakas"],
    ["ΧΑΛΚΙΑΔΑΚΗΣ", "Chalkiadakis"],
    ["ΒΑΣΙΛΟΠΟΥΛΟΣ", "Vasilopoulos"],
    ["ΠΑΠΑΘΑΝΑΣΙΟΥ", "Papathanasiou"],
    ["ΚΑΛΟΥΔΗΣ", "Kaloudis"],
    ["ΑΝΤΩΝΑΚΟΣ", "Antonakos"],
    ["Χαλκιαδάκης", "Halkiadakis"],
  ])("matches %s to %s", (greek, latin) => {
    expect(surnameKey(greek)).toBe(surnameKey(latin));
  });

  it("keeps different surnames apart", () => {
    expect(surnameKey("ΧΑΛΚΙΑΔΑΚΗΣ")).not.toBe(surnameKey("Tsiardakas"));
  });
});
