/**
 * tests/utils.test.js
 * Tests for lib/utils.js -- fmt, parseScore, fmtDate, slugify.
 */
import { describe, it, expect } from "vitest";
import { fmt, parseScore, fmtDate, slugify } from "../lib/utils.js";

// ─── fmt ──────────────────────────────────────────────────────────────────────

describe("fmt", () => {
  it("returns empty string for null", () => {
    expect(fmt(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(fmt(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(fmt("")).toBe("");
  });

  it("returns single-word name as-is", () => {
    expect(fmt("Giannis")).toBe("Giannis");
  });

  it("formats two-word name as 'Surname F.'", () => {
    expect(fmt("Giorgos Antonakos")).toBe("Antonakos G.");
  });

  it("handles extra whitespace", () => {
    expect(fmt("  Giorgos   Antonakos  ")).toBe("Antonakos G.");
  });

  it("handles three-word name -- uses last word as surname", () => {
    expect(fmt("Maria Anna Papadopoulou")).toBe("Papadopoulou M.");
  });
});

// ─── parseScore ───────────────────────────────────────────────────────────────

describe("parseScore", () => {
  it("returns null for null", () => {
    expect(parseScore(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseScore("")).toBeNull();
  });

  it("parses en-dash format", () => {
    expect(parseScore("85\u201372")).toEqual({ ak: 85, opp: 72 });
  });

  it("parses hyphen format", () => {
    expect(parseScore("85-72")).toEqual({ ak: 85, opp: 72 });
  });

  it("returns null for non-numeric parts", () => {
    expect(parseScore("N/A")).toBeNull();
  });

  it("returns null for three-part score", () => {
    expect(parseScore("85-72-60")).toBeNull();
  });

  it("returns null for single number (no separator)", () => {
    expect(parseScore("85")).toBeNull();
  });
});

// ─── slugify ──────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("transliterates Greek to Latin", () => {
    expect(slugify("Γιώργος Αντωνάκος")).toBe("giorgos-antonakos");
  });

  it("strips non-alphanumeric characters (adjacent specials leave double-hyphens)", () => {
    // "Test! @#$ Name" -> spaces->hyphens, then specials stripped -> "test--name"
    // slugify does not collapse consecutive hyphens; document actual behavior
    expect(slugify("Test! @#$ Name")).toBe("test--name");
  });

  it("lowercases Latin input", () => {
    expect(slugify("Giorgos Antonakos")).toBe("giorgos-antonakos");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("collapses multiple spaces into single hyphen", () => {
    expect(slugify("a  b")).toBe("a-b");
  });
});

// ─── fmtDate ─────────────────────────────────────────────────────────────────

describe("fmtDate", () => {
  it("returns empty string for empty string", () => {
    expect(fmtDate("")).toBe("");
  });

  it("returns empty string for null", () => {
    expect(fmtDate(null)).toBe("");
  });

  it("returns original string for unparseable date", () => {
    expect(fmtDate("not-a-date")).toBe("not-a-date");
  });

  it("formats ISO date into human-readable form", () => {
    const result = fmtDate("2025-09-14");
    // Should contain "2025" and "Sep" in some locale-dependent format
    expect(result).toContain("2025");
    expect(result).toContain("Sep");
  });
});
