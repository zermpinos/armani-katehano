/**
 * tests/import.test.js
 * Tests for the pure helper logic in pages/api/admin/import.js:
 *   - Greek date parsing
 *   - League slug detection from URL
 *   - Minutes parsing (rounds to nearest minute)
 */
import { describe, it, expect } from "vitest";

// ─── Inline the pure helpers from import.js ───────────────────────────────────

const GREEK_MONTHS = {
  "Ιανουαρίου": "01", "Φεβρουαρίου": "02", "Μαρτίου":     "03",
  "Απριλίου":   "04", "Μαΐου":       "05", "Ιουνίου":     "06",
  "Ιουλίου":    "07", "Αυγούστου":   "08", "Σεπτεμβρίου": "09",
  "Οκτωβρίου":  "10", "Νοεμβρίου":   "11", "Δεκεμβρίου":  "12",
};

function parseGreekDate(dateStr) {
  const match = (dateStr || "").match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
  if (!match) return null;
  const day   = match[1].padStart(2, "0");
  const month = GREEK_MONTHS[match[2]] || null;
  const year  = match[3];
  if (!month) return null;
  return new Date(`${year}-${month}-${day}`);
}

function detectLeagueSlug(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("winter-cup"))  return "wintercup";
  if (u.includes("rookie"))      return "rookie";
  if (u.includes("bc6"))         return "bc6";
  return "";
}

function parseMinutes(minStr) {
  const m = (minStr || "").match(/^(\d+):(\d{2})$/);
  if (!m) return 0;
  const mins = parseInt(m[1], 10);
  const secs = parseInt(m[2], 10);
  return secs >= 30 ? mins + 1 : mins;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("parseGreekDate", () => {
  it("parses a full Greek date string", () => {
    const d = parseGreekDate("Κυριακή, 14 Σεπτεμβρίου 2025");
    expect(d).not.toBeNull();
    expect(d.toISOString().startsWith("2025-09-14")).toBe(true);
  });

  it("parses all 12 Greek month names", () => {
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
});

describe("detectLeagueSlug", () => {
  it("detects wintercup", () => {
    expect(detectLeagueSlug("https://basketcity.sportstats.gr/winter-cup/game/123")).toBe("wintercup");
  });

  it("detects rookie", () => {
    expect(detectLeagueSlug("https://basketcity.sportstats.gr/rookie/game/456")).toBe("rookie");
  });

  it("detects bc6", () => {
    expect(detectLeagueSlug("https://basketcity.sportstats.gr/bc6/game/789")).toBe("bc6");
  });

  it("returns empty string for regular season URL", () => {
    expect(detectLeagueSlug("https://basketcity.sportstats.gr/men/gamedetails/id/999")).toBe("");
  });

  it("returns empty string for null/empty", () => {
    expect(detectLeagueSlug("")).toBe("");
    expect(detectLeagueSlug(null)).toBe("");
  });

  it("is case-insensitive", () => {
    expect(detectLeagueSlug("https://BASKETCITY.COM/WINTER-CUP/game/1")).toBe("wintercup");
  });
});

describe("parseMinutes", () => {
  it("parses whole minutes", () => {
    expect(parseMinutes("26:00")).toBe(26);
  });

  it("rounds up when seconds >= 30", () => {
    expect(parseMinutes("26:30")).toBe(27);
    expect(parseMinutes("26:59")).toBe(27);
  });

  it("rounds down when seconds < 30", () => {
    expect(parseMinutes("26:29")).toBe(26);
    expect(parseMinutes("26:01")).toBe(26);
  });

  it("returns 0 for 0:00", () => {
    expect(parseMinutes("0:00")).toBe(0);
  });

  it("returns 0 for empty/invalid string", () => {
    expect(parseMinutes("")).toBe(0);
    expect(parseMinutes("26")).toBe(0);
    expect(parseMinutes(null)).toBe(0);
  });
});