// @ts-nocheck
import { describe, it, expect } from "vitest";
import { isStarter } from "@/domain/roster";

describe("isStarter", () => {
  it("returns false for null", () => {
    expect(isStarter(null)).toBe(false);
  });
  it("returns false for undefined", () => {
    expect(isStarter(undefined)).toBe(false);
  });
  it("returns false for empty string", () => {
    expect(isStarter("")).toBe(false);
  });
  it("returns true for 'starter'", () => {
    expect(isStarter("starter")).toBe(true);
  });
  it("returns true for 'Starting'", () => {
    expect(isStarter("Starting")).toBe(true);
  });
  it("returns true for 'STARTER'", () => {
    expect(isStarter("STARTER")).toBe(true);
  });
  it("returns true for 'start'", () => {
    expect(isStarter("start")).toBe(true);
  });
  it("trims surrounding whitespace", () => {
    expect(isStarter("  starter  ")).toBe(true);
  });
  it("returns false for unrelated notes", () => {
    expect(isStarter("Capt")).toBe(false);
    expect(isStarter("Game Time?")).toBe(false);
  });
});
