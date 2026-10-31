import { describe, it, expect } from "vitest";
import { sourceGameId, sameSourceGame } from "@/domain/import/identity";

const ID  = "172B9468-3076-4D51-ADF8-560555B99406";
const CUP = `https://basketcity.sportstats.gr/winter-cup/gamedetails/id/${ID}`;

describe("sourceGameId", () => {
  it.each([
    ["the plain URL",            CUP],
    ["another competition path", `https://basketcity.sportstats.gr/super-winter-cup/gamedetails/id/${ID}`],
    ["a trailing newline",       `${CUP}\n`],
    ["a trailing slash",         `${CUP}/`],
    ["a query string",           `${CUP}?tab=boxscore`],
    ["lower case",               CUP.toLowerCase()],
  ])("reads the same id from %s", (_label, url) => {
    expect(sourceGameId(url)).toBe(ID);
  });

  it("finds no id in a URL without one, or in no URL", () => {
    expect(sourceGameId("https://example.com/men/game/4711")).toBeNull();
    expect(sourceGameId(null)).toBeNull();
    expect(sourceGameId("")).toBeNull();
  });
});

describe("sameSourceGame", () => {
  it("matches two paths and spellings of one game", () => {
    expect(sameSourceGame(CUP, `https://basketcity.sportstats.gr/super-winter-cup/gamedetails/id/${ID.toLowerCase()}`)).toBe(true);
  });

  it("tells two games apart", () => {
    expect(sameSourceGame(CUP, "https://basketcity.sportstats.gr/winter-cup/gamedetails/id/AAA")).toBe(false);
  });

  it("matches a URL without an id only to itself", () => {
    expect(sameSourceGame("https://example.com/men/game/4711", "https://example.com/men/game/4711\n")).toBe(true);
    expect(sameSourceGame("https://example.com/men/game/4711", "https://example.com/men/game/4712")).toBe(false);
  });

  it("never matches a missing URL", () => {
    expect(sameSourceGame(null, null)).toBe(false);
  });
});
