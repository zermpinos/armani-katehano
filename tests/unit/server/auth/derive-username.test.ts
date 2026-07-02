import { describe, it, expect } from "vitest";
import { deriveUsername, deriveUsernameWithSuffix } from "@/server/auth/derive-username";

describe("deriveUsername", () => {
  it("takes first initial of first name and full last name, lowercased", () => {
    expect(deriveUsername("Armani Katehano")).toBe("a.katehano");
  });

  it("strips Greek diacritics", () => {
    expect(deriveUsername("Άρτεμις Παπαδοπούλου")).toBe("a.papadopoulou");
  });

  it("uses the last space-separated token as last name", () => {
    expect(deriveUsername("Maria Anna Van Der Berg")).toBe("m.berg");
  });

  it("falls back to full name when only one token", () => {
    expect(deriveUsername("Cher")).toBe("cher");
  });

  it("throws on empty or whitespace-only input", () => {
    expect(() => deriveUsername("")).toThrow();
    expect(() => deriveUsername("   ")).toThrow();
  });
});

describe("deriveUsernameWithSuffix", () => {
  it("appends numeric suffix on collision", () => {
    expect(deriveUsernameWithSuffix("a.katehano", 0)).toBe("a.katehano");
    expect(deriveUsernameWithSuffix("a.katehano", 1)).toBe("a.katehano2");
    expect(deriveUsernameWithSuffix("a.katehano", 4)).toBe("a.katehano5");
  });
});
