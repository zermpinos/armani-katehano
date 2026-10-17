import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeadToHeadBlock } from "@/client/games/HeadToHeadBlock";
import { headToHead } from "@/domain/stats/head-to-head";
import { fmtDate } from "@/domain/shared/format";

const games = [{ id: "cmgame0000000000000000001", date: "2026-09-12", opponent: "New York Bricks", home: true, result: "W", score: "68-61", season: "2026-27", leagueName: "Winter Cup" }];

describe("HeadToHeadBlock", () => {
  it("shows the record, each meeting linked to its box score, and the opponent page", () => {
    const html = renderToStaticMarkup(createElement(HeadToHeadBlock, {
      h2h: headToHead(games, "New York Bricks"), title: "Earlier meetings", emptyText: "First meeting.", showAllLink: true,
    }));
    expect(html).toContain('aria-label="Earlier meetings"');
    expect(html).toContain("Record: 1-0");
    expect(html).toContain('href="/games/cmgame0000000000000000001"');
    expect(html).toContain(`${fmtDate("2026-09-12")} · Winter Cup 2026-27 · `);
    expect(html).toContain('href="/opponents/new-york-bricks"');
  });

  it("shows the record but no opponent link when the name has no Latin letters or digits", () => {
    const greek = [{ ...games[0]!, opponent: "ΚΟΥΒΑΔΕΣ" }];
    const html = renderToStaticMarkup(createElement(HeadToHeadBlock, {
      h2h: headToHead(greek, "ΚΟΥΒΑΔΕΣ"), title: "Earlier meetings", emptyText: "First meeting.", showAllLink: true,
    }));
    expect(html).toContain("Record: 1-0");
    expect(html).not.toContain("/opponents/");
  });

  it("says first meeting, with no record and no link, when none exist", () => {
    const html = renderToStaticMarkup(createElement(HeadToHeadBlock, {
      h2h: headToHead(games, "Delulu"), title: "Against Delulu", emptyText: "First meeting.", showAllLink: true,
    }));
    expect(html).toContain("First meeting.");
    expect(html).not.toContain("Record:");
    expect(html).not.toContain("/opponents/");
  });
});
