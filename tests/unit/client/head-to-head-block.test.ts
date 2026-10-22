import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeadToHeadBlock, HeadToHeadFull, HeadToHeadLine } from "@/client/games/HeadToHeadBlock";
import { headToHead, type MeetingSource } from "@/domain/stats/head-to-head";
import { fmtDate } from "@/domain/shared/format";

const game = (n: number, date: string, result: string, opponent = "New York Bricks"): MeetingSource => ({
  id: `cmgame${String(n).padStart(19, "0")}`, date, opponent, home: true, result,
  score: result === "W" ? "68-61" : "55-60", season: date < "2026-07-01" ? "2025-26" : "2026-27", leagueName: "Winter Cup",
});

const four = [game(1, "2026-09-12", "W"), game(2, "2026-03-15", "W"), game(3, "2026-01-20", "L"), game(4, "2025-11-02", "W")];

const card = (games: MeetingSource[], opponent = "New York Bricks", linkFirstMeeting = false) =>
  renderToStaticMarkup(createElement(HeadToHeadBlock, {
    h2h: headToHead(games, opponent, { limit: 3 }), title: "Earlier meetings", linkFirstMeeting,
  }));

const line = (games: MeetingSource[], opponent = "New York Bricks") =>
  renderToStaticMarkup(createElement(HeadToHeadLine, { h2h: headToHead(games, opponent, { limit: 3 }) }));

describe("HeadToHeadBlock", () => {
  it("is a region named by its heading", () => {
    const html = card(four);
    const id = html.match(/<section aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<h3 id="${id}"`);
    expect(html).toMatch(/<h3[^>]*>Earlier meetings<\/h3>/);
  });

  it("shows the record with its words, the meeting count and the last results", () => {
    const html = card(four);
    expect(html).toContain(">3-1<");
    expect(html).toContain("3 wins, 1 loss");
    expect(html).toContain("4 meetings");
    expect(html).toContain(">Last 4<");
  });

  it("lists the meetings it was given, each linked, with the competition and no season", () => {
    const html = card(four);
    expect(html.match(/href="\/games\//g)).toHaveLength(3);
    expect(html).toContain('href="/games/cmgame0000000000000000001"');
    expect(html).toContain(fmtDate("2026-09-12"));
    expect(html).toContain(">Winter Cup<");
    expect(html).not.toContain("2026-27");
    expect(html).not.toContain("2025-26");
  });

  it("names each result for screen readers and hides the letter", () => {
    const html = card(four);
    expect(html).toMatch(/<span aria-hidden="true">W<\/span><span class="sr-only">Win<\/span>/);
    expect(html).toMatch(/<span aria-hidden="true">L<\/span><span class="sr-only">Loss<\/span>/);
  });

  it("links to the opponent page when they have met", () => {
    expect(card(four)).toContain('href="/opponents/new-york-bricks"');
  });

  it("shows one full-width record tile and no form for a single meeting", () => {
    const html = card([four[0]!]);
    expect(html).toContain(">1-0<");
    expect(html).toContain("1 meeting");
    expect(html).not.toContain("1 meetings");
    expect(html).toContain("col-span-2");
    expect(html).not.toContain("<ol");
  });

  it("says first meeting, with no tiles and no links, when they have not met", () => {
    const html = card([], "Delulu");
    expect(html).toContain("First meeting between the teams.");
    expect(html).not.toContain("/opponents/");
    expect(html).not.toContain("/games/");
  });

  it("links a first meeting to the opponent page when asked, as under a box score", () => {
    const html = card([], "Delulu", true);
    expect(html).toContain("First meeting between the teams.");
    expect(html).toContain('href="/opponents/delulu"');
  });

  it("never links an opponent whose name has no Latin letters or digits", () => {
    const greek = four.map(g => ({ ...g, opponent: "ΚΟΥΒΑΔΕΣ" }));
    const html = card(greek, "ΚΟΥΒΑΔΕΣ", true);
    expect(html).toContain(">3-1<");
    expect(html).not.toContain("/opponents/");
  });

  it("counts a tie in the record and its words", () => {
    const html = card([...four, game(5, "2025-10-01", "T")]);
    expect(html).toContain(">3-1-1<");
    expect(html).toContain("3 wins, 1 loss, 1 tie");
    expect(html).toContain("5 meetings");
  });

  it("counts a meeting whose result is not W, L or T", () => {
    const html = card([game(1, "2026-09-12", "F")]);
    expect(html).not.toContain("First meeting");
    expect(html).toContain("1 meeting");
    expect(html).toContain('href="/games/cmgame0000000000000000001"');
  });

  it("leaves the form strip to its tile's label, so it is announced once", () => {
    const html = card(four);
    expect(html).toContain('<ol role="list"');
    expect(html).not.toContain('aria-label="Last');
  });

  it("stacks its tiles when the panel is too narrow for five results side by side", () => {
    const html = card(four);
    expect(html).toMatch(/<section [^>]*class="@container /);
    expect(html).toContain('class="grid grid-cols-1 gap-2 @min-[280px]:grid-cols-2"');
  });
});

describe("HeadToHeadLine", () => {
  it("shows the record, the last results and the opponent link, without a landmark or rows", () => {
    const html = line(four);
    expect(html).toContain("Head-to-head:");
    expect(html).toContain(">3-1<");
    expect(html).toContain('aria-label="Last 4 results, newest first"');
    expect(html).toContain('href="/opponents/new-york-bricks"');
    expect(html).not.toContain("/games/");
    expect(html).not.toContain("<section");
  });

  it("skips the form for a single meeting", () => {
    const html = line([four[0]!]);
    expect(html).toContain(">1-0<");
    expect(html).not.toContain("results, newest first");
  });

  it("says first meeting, with no link, when they have not met", () => {
    const html = line([], "Delulu");
    expect(html).toContain("First meeting between the teams.");
    expect(html).not.toContain("/opponents/");
  });

  it("names the opponent in its link for screen readers", () => {
    expect(line(four)).toContain('All meetings<span class="sr-only"> against New York Bricks</span> ›');
  });

  it("rings the newest result with an outline, so the gap shows the row behind it", () => {
    const html = line(four);
    expect(html).toContain("outline-offset-2");
    expect(html).not.toContain("ring-offset");
  });
});

describe("HeadToHeadFull", () => {
  const full = (games: MeetingSource[], opponent = "New York Bricks") =>
    renderToStaticMarkup(createElement(HeadToHeadFull, { h2h: headToHead(games, opponent) }));

  it("shows the record and form tiles, then every meeting with its season", () => {
    const html = full([...four, game(5, "2025-10-01", "L")]);
    expect(html).toContain(">RECORD<");
    expect(html).toContain(">3-2<");
    expect(html).toContain("3 wins, 2 losses");
    expect(html).toContain("5 meetings");
    expect(html).toContain(">LAST 5<");
    expect(html).not.toContain('aria-label="Last');
    expect(html.match(/href="\/games\//g)).toHaveLength(5);
    expect(html).toContain("Winter Cup 2026-27");
    expect(html).toContain("Winter Cup 2025-26");
  });

  it("is a region named Every meeting, with the count beside its heading", () => {
    const html = full(four);
    const id = html.match(/<section aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<h3 id="${id}"`);
    expect(html).toMatch(/>Every meeting<\/h3><span aria-hidden="true"[^>]*>4<\/span>/);
  });

  it("does not link to itself", () => {
    expect(full(four)).not.toContain("/opponents/");
  });

  it("shows a full-width record tile and no form for a single meeting", () => {
    const html = full([four[0]!]);
    expect(html).toContain("1 meeting");
    expect(html).toContain("col-span-2");
    expect(html).not.toContain(">LAST ");
  });
});
