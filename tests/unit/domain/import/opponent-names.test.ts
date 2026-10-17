import { describe, it, expect } from "vitest";
import { buildAliases, suggestDisplayName } from "@/domain/import/opponents";
import { waitingNames, similarNames } from "@/domain/import/opponent-names";

const aliases = buildAliases([{ scrapedName: "NEW YORK BRICKS", displayName: "New York Bricks" }]);

describe("waitingNames", () => {
  it("lists unmapped fixtures and unknown result opponents, minus names already held", () => {
    const summary = {
      fixtures: { unmapped: [
        { scrapedName: "NY BRICKS", suggestion: "Ny Bricks", dateText: "Κυριακή, 18 Οκτωβρίου 2026" },
        { scrapedName: "new  york bricks", suggestion: "New York Bricks", dateText: "x" },
      ] },
      unknownOpponents: [{ scrapedName: "TAZ BOYS", suggestion: "Taz Boys", sourceUrl: "https://example.test/g/1" }],
    };
    expect(waitingNames(summary, aliases)).toEqual([
      { scrapedName: "NY BRICKS", suggestion: "Ny Bricks", waitingOn: "fixture", dateText: "Κυριακή, 18 Οκτωβρίου 2026" },
      { scrapedName: "TAZ BOYS", suggestion: "Taz Boys", waitingOn: "result", dateText: null },
    ]);
  });

  it("lists a name once when a fixture and a result both wait on it", () => {
    const summary = {
      fixtures: { unmapped: [{ scrapedName: "TAZ BOYS", suggestion: "Taz Boys", dateText: "d" }] },
      unknownOpponents: [{ scrapedName: "taz boys", suggestion: "Taz Boys", sourceUrl: "u" }],
    };
    expect(waitingNames(summary, aliases)).toHaveLength(1);
  });

  it("is empty for a missing or older summary", () => {
    expect(waitingNames(null, aliases)).toEqual([]);
    expect(waitingNames({ listed: 4 }, aliases)).toEqual([]);
  });
});

describe("similarNames", () => {
  const names = ["Cappuccino Knights", "Miami Bricks", "New York Bricks", "Prison Bricks", "The 90s"];

  it("finds existing names that share a word of four or more letters", () => {
    expect(similarNames("NY BRICKS", names)).toEqual(["Miami Bricks", "New York Bricks", "Prison Bricks"]);
  });

  it("ignores short words such as the or bc", () => {
    expect(similarNames("THE BC", names)).toEqual([]);
  });

  it("caps the list", () => {
    expect(similarNames("BRICKS", names, 2)).toHaveLength(2);
  });
});

describe("suggestDisplayName", () => {
  it("title-cases the source's caps", () => {
    expect(suggestDisplayName("ATALANTOI HAWKS")).toBe("Atalantoi Hawks");
    expect(suggestDisplayName("PATISSIA THUNDERS")).toBe("Patissia Thunders");
  });

  it("is only a suggestion: it cannot know a brand's own spelling", () => {
    expect(suggestDisplayName("TAZ BOYS")).not.toBe("Taz Boyz");
  });
});
