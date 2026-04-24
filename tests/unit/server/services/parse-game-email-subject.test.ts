import { describe, it, expect } from "vitest";
import { parseSubject } from "@/server/services/parse-game-email-subject";

describe("parseSubject", () => {
  describe("strict regex match", () => {
    it("parses AK as home team", () => {
      const r = parseSubject("ARMANI KATEHANO - ΑΡΗΣ (2024/01/15)");
      expect(r).not.toBeNull();
      expect(r!.akSide).toBe("home");
      expect(r!.opponent).toBe("ΑΡΗΣ");
      expect(r!.dateStr).toBe("2024-01-15");
    });

    it("parses AK as away team", () => {
      const r = parseSubject("ΠΑΝΑΘΗΝΑΪΚΟΣ - ARMANI KATEHANO (2024/03/22)");
      expect(r).not.toBeNull();
      expect(r!.akSide).toBe("away");
      expect(r!.opponent).toBe("ΠΑΝΑΘΗΝΑΪΚΟΣ");
      expect(r!.dateStr).toBe("2024-03-22");
    });

    it("accepts en-dash separator", () => {
      const r = parseSubject("ARMANI KATEHANO - ΟΛΥΜΠΙΑΚΟΣ (2024/02/10)");
      expect(r).not.toBeNull();
      expect(r!.akSide).toBe("home");
    });

    it("accepts em-dash separator", () => {
      const r = parseSubject("ΑΡΗΣ -- KATEHANO (2024/02/10)");
      expect(r).not.toBeNull();
      expect(r!.akSide).toBe("away");
    });

    it("matches on KATEHANO alone", () => {
      const r = parseSubject("ΑΕΚ - KATEHANO (2025/11/01)");
      expect(r).not.toBeNull();
      expect(r!.akSide).toBe("away");
      expect(r!.opponent).toBe("ΑΕΚ");
    });

    it("matches on ARMANI alone", () => {
      const r = parseSubject("ARMANI - ΛΑΡΙΣΑ (2025/11/01)");
      expect(r).not.toBeNull();
      expect(r!.akSide).toBe("home");
    });
  });

  describe("fuzzy fallback", () => {
    it("handles diacritic normalization in team names", () => {
      // Subject with combining diacritics that mess up the regex
      const subject = "ARMANI KATEHANO - ΑΡΗΣ (2024/04/01)";
      const r = parseSubject(subject);
      expect(r).not.toBeNull();
    });

    it("falls back to loose separator (pipe)", () => {
      const r = parseSubject("ARMANI KATEHANO | ΠΑΟΚ (2024/05/05)");
      expect(r).not.toBeNull();
      expect(r!.akSide).toBe("home");
      expect(r!.opponent).toBe("ΠΑΟΚ");
    });

    it("falls back to loose separator (slash)", () => {
      const r = parseSubject("ΟΛΥΜΠΙΑΚΟΣ / KATEHANO (2024/05/05)");
      expect(r).not.toBeNull();
      expect(r!.akSide).toBe("away");
    });
  });

  describe("non-matching subjects", () => {
    it("returns null when AK not identified", () => {
      expect(parseSubject("ΑΡΗΣ - ΟΛΥΜΠΙΑΚΟΣ (2024/01/15)")).toBeNull();
    });

    it("returns null when date is missing", () => {
      expect(parseSubject("ARMANI KATEHANO - ΑΡΗΣ")).toBeNull();
    });

    it("returns null for completely unrelated subject", () => {
      expect(parseSubject("Monthly newsletter -- February 2024")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseSubject("")).toBeNull();
    });
  });

  describe("date formatting", () => {
    it("converts YYYY/MM/DD to YYYY-MM-DD", () => {
      const r = parseSubject("ARMANI - ΑΡΗΣ (2025/06/08)");
      expect(r!.dateStr).toBe("2025-06-08");
    });
  });
});
