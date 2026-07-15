// @ts-nocheck
/**
 * tests/utils.test.js
 * Tests for lib/utils - fmt, slugify, resolveImportUrl, fmtDate.
 */
import { describe, it, expect } from "vitest";
import { fmt, slugify } from "@/domain/players/format";
import { fmtDate, resolveImportUrl } from "@/domain/shared/format";

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

  it("handles three-word name - uses last word as surname", () => {
    expect(fmt("Maria Anna Papadopoulou")).toBe("Papadopoulou M.");
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

// ─── resolveImportUrl ─────────────────────────────────────────────────────────

describe("resolveImportUrl", () => {
  it("uses overrideUrl when it is a string", () => {
    expect(resolveImportUrl("https://override.com", "https://state.com")).toBe("https://override.com");
  });

  it("falls back to stateUrl when overrideUrl is undefined", () => {
    expect(resolveImportUrl(undefined, "https://state.com")).toBe("https://state.com");
  });

  it("falls back to stateUrl when overrideUrl is a non-string object (SyntheticEvent regression)", () => {
    // Regression: onClick={fetchAndReview} passed the SyntheticEvent as overrideUrl,
    // causing (overrideUrl ?? gameUrl).trim() to throw "trim is not a function".
    expect(resolveImportUrl({} as any, "https://state.com")).toBe("https://state.com");
    expect(resolveImportUrl(new Event("click") as any, "https://state.com")).toBe("https://state.com");
  });

  it("trims whitespace from resolved URL", () => {
    expect(resolveImportUrl("  https://foo.com  ", "https://bar.com")).toBe("https://foo.com");
    expect(resolveImportUrl(undefined, "  https://bar.com  ")).toBe("https://bar.com");
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
