// @ts-nocheck
import { describe, it, expect } from "vitest";
import { sanitize } from "@/domain/shared/format";

describe("sanitize", () => {
  it("returns plain string unchanged", () => {
    expect(sanitize("Big test this Friday.")).toBe("Big test this Friday.");
  });
  it("strips null bytes", () => {
    expect(sanitize("a\x00b")).toBe("ab");
  });
  it("strips tab, LF, CR", () => {
    expect(sanitize("a\tb\nc\rd")).toBe("abcd");
  });
  it("strips DEL (0x7F)", () => {
    expect(sanitize("a\x7Fb")).toBe("ab");
  });
  it("trims surrounding whitespace", () => {
    expect(sanitize("   hello   ")).toBe("hello");
  });
  it("truncates at 1000 characters", () => {
    const s = "x".repeat(1500);
    expect(sanitize(s)).toHaveLength(1000);
  });
  it("returns empty string for an all-whitespace input", () => {
    expect(sanitize("   \t\n   ")).toBe("");
  });
});
