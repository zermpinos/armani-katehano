/**
 * tests/import.test.js
 * Tests for lib/greekDate.js helpers (parseGreekDate, detectLeagueSlug, parseMinutes).
 *
 * Previously this file inlined copies of the functions rather than importing them,
 * so it tested stale duplicates instead of production code. Fixed: now imports from source.
 */
import { describe, it, expect } from "vitest";
import { parseGreekDate, detectLeagueSlug, parseMinutes } from "../lib/greekDate.js";

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("parseGreekDate", () => {
  it("parses a full Greek date string", () => {
    const d = parseGreekDate("Κυριακή, 14 Σεπτεμβρίου 2025");
    expect(d).not.toBeNull();
    expect(d.toISOString().startsWith("2025-09-14")).toBe(true);
  });

  it("parses all 12 Greek month names (genitive)", () => {
    const cases = [
      ["1 Ιανουαρίου 2025",  "2025-01-01"],
      ["5 Φεβρουαρίου 2025", "2025-02-05"],
      ["15 Μαρτίου 2025",    "2025-03-15"],
      ["3 Απριλίου 2025",    "2025-04-03"],
      ["20 Μαΐου 2025",      "2025-05-20"],
      ["7 Ιουνίου 2025",     "2025-06-07"],
      ["11 Ιουλίου 2025",    "2025-07-11"],
      ["22 Αυγούστου 2025",  "2025-08-22"],
      ["14 Σεπτεμβρίου 2025","2025-09-14"],
      ["9 Οκτωβρίου 2025",   "2025-10-09"],
      ["30 Νοεμβρίου 2025",  "2025-11-30"],
      ["25 Δεκεμβρίου 2025", "2025-12-25"],
    ];
    for (const [input, expected] of cases) {
      const d = parseGreekDate(input);
      expect(d?.toISOString().startsWith(expected), input).toBe(true);
    }
  });

  it("parses nominative case month names", () => {
    const d = parseGreekDate("15 Ιανουάριος 2025");
    expect(d).not.toBeNull();
    expect(d.toISOString().startsWith("2025-01-15")).toBe(true);
  });

  it("returns null for empty string", () => {
    expect(parseGreekDate("")).toBeNull();
  });

  it("returns null for unrecognised month", () => {
    expect(parseGreekDate("14 January 2025")).toBeNull();
  });

  it("handles single-digit day", () => {
    const d = parseGreekDate("7 Μαρτίου 2026");
    expect(d?.toISOString().startsWith("2026-03-07")).toBe(true);
  });

  it("returns null for out-of-range year", () => {
    expect(parseGreekDate("1 Μαρτίου 1999")).toBeNull();
    expect(parseGreekDate("1 Μαρτίου 2101")).toBeNull();
  });

  it("returns null for day > 31", () => {
    expect(parseGreekDate("32 Μαρτίου 2025")).toBeNull();
  });
});

describe("detectLeagueSlug", () => {
  it("detects wintercup", () => {
    expect(detectLeagueSlug("https://basketcity.sportstats.gr/wintercup/game/123")).toBe("wintercup");
  });

  it("returns null for winter-cup (hyphenated) -- real function only matches 'wintercup' substring", () => {
    expect(detectLeagueSlug("https://basketcity.sportstats.gr/winter-cup/game/123")).toBeNull();
  });

  it("detects rookie", () => {
    expect(detectLeagueSlug("https://basketcity.sportstats.gr/rookie/game/456")).toBe("rookie");
  });

  it("detects bc6", () => {
    expect(detectLeagueSlug("https://basketcity.sportstats.gr/bc6/game/789")).toBe("bc6");
  });

  it("returns null (not empty string) for unknown URL", () => {
    expect(detectLeagueSlug("https://basketcity.sportstats.gr/men/gamedetails/id/999")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(detectLeagueSlug(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectLeagueSlug("")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(detectLeagueSlug("https://BASKETCITY.COM/WINTERCUP/game/1")).toBe("wintercup");
  });
});

describe("parseMinutes", () => {
  it("parses whole minutes", () => {
    expect(parseMinutes("26:00")).toBe(26);
  });

  it("returns decimal minutes for non-zero seconds", () => {
    expect(parseMinutes("26:30")).toBe(+(26 + 30 / 60).toFixed(2)); // 26.5
    expect(parseMinutes("27:51")).toBe(+(27 + 51 / 60).toFixed(2)); // 27.85
    expect(parseMinutes("32:14")).toBe(+(32 + 14 / 60).toFixed(2)); // 32.23
  });

  it("parses plain numeric string (no colon)", () => {
    expect(parseMinutes("26")).toBe(26);
  });

  it("returns 0 for 0:00", () => {
    expect(parseMinutes("0:00")).toBe(0);
  });

  it("returns 0 for empty/invalid string", () => {
    expect(parseMinutes("")).toBe(0);
    expect(parseMinutes(null)).toBe(0);
  });

  it("returns 0 for DNP", () => {
    expect(parseMinutes("DNP")).toBe(0);
  });
});
