import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoxScoreTable } from "@/client/games/box-score";
import { calcEff } from "@/domain/stats";

const line = (number: number, s: Record<string, number>) => {
  const r = {
    pid: `p${number}`, slug: `player-${number}`, name: `Player ${number}`, number, position: "G",
    min: 0, pts: 0, reb: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
    fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, ...s,
  };
  return { ...r, eff: calcEff(r) };
};

const lines = [
  line(4, { min: 28.25, pts: 14, reb: 5, ast: 3, stl: 1, tov: 2, fgm: 6, fga: 11, fg3m: 2, fg3a: 5 }),
  line(7, { min: 31.5, pts: 18, reb: 7, ast: 2, blk: 1, tov: 1, fgm: 7, fga: 13, fg3m: 1, fg3a: 3, ftm: 3, fta: 4 }),
];

const render = (boxScore: unknown[], teamScore = 32) =>
  renderToStaticMarkup(createElement(BoxScoreTable, {
    game: {
      date: "2026-11-10", opponent: "Delulu", home: true, result: "W", score: `${teamScore}-30`, teamScore,
      sourceUrl: null, youtubeUrl: null, boxScore,
    },
  }));

const teamCells = (html: string) => {
  const foot = html.match(/<tfoot>(.*)<\/tfoot>/s)?.[1] ?? "";
  return [...foot.matchAll(/<t[dh][^>]*>([^<]*)<\/t[dh]>/g)].map(m => m[1]);
};

describe("BoxScoreTable team totals", () => {
  it("adds a TEAM row that sums every column of the lines shown", () => {
    expect(teamCells(render(lines))).toEqual([
      "", "TEAM", "59:45", "32", "12", "5", "1", "1", "3", "13", "24", "3", "8", "3", "4", "36",
    ]);
  });

  it("shows team shooting from the summed makes and attempts", () => {
    expect(render(lines)).toContain("FG 13/24 54.2% · 3P 3/8 37.5% · FT 3/4 75.0%");
  });

  it("shows no percentage for a shot type with no attempts", () => {
    const html = render([line(4, { min: 20, pts: 4, fgm: 2, fga: 5 })], 4);
    expect(html).toContain("FG 2/5 40.0% · 3P 0/0 · FT 0/0");
  });

  it("shows a dash for minutes when no line has any", () => {
    expect(teamCells(render([line(4, { pts: 2, fgm: 1, fga: 1 })], 2))[2]).toBe("-");
  });

  it("notes when the player lines do not add up to the team's score", () => {
    expect(render(lines, 35)).toContain("Player lines add up to 32 points; the team scored 35.");
  });

  it("adds no note when they do", () => {
    expect(render(lines, 32)).not.toContain("Player lines add up");
  });

  it("adds no totals to a game without a box score", () => {
    const html = render([]);
    expect(html).toContain("No box score recorded for this game.");
    expect(html).not.toContain("<tfoot>");
    expect(html).not.toContain("FG ");
  });
});
