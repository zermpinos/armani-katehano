import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewCards } from "@/client/admin/import/ReviewCards";
import { playedIn } from "@/client/admin/import/line-assign";
import { ZERO_ROW } from "@/domain/import/resolve";

const players = [
  { id: "a", name: "Anna Alpha",   number: 4, position: "PG" },
  { id: "b", name: "Ben Bravo",    number: 7, position: "SG" },
  { id: "c", name: "Cara Charlie", number: 9, position: "C" },
];
const rows = [
  { playerId: "c", ...ZERO_ROW, min: 10, pts: 2 },
  { playerId: "a", ...ZERO_ROW },
  { playerId: "b", ...ZERO_ROW, min: 20, pts: 11, reb: 5, orb: 3, drb: 2, ast: 1, pf: 4 },
];
const render = (box = rows, playedIds = playedIn(rows)) =>
  renderToStaticMarkup(createElement(ReviewCards, { players, rows: box, playedIds, onUpdate: () => {} }));

describe("ReviewCards", () => {
  it("lists who played by jersey, with the rest folded", () => {
    const html = render();
    const fold = html.indexOf("t play (1)");
    expect(fold).toBeGreaterThan(-1);
    expect(html.indexOf("Bravo B.")).toBeLessThan(html.indexOf("Charlie C."));
    expect(html.indexOf("Charlie C.")).toBeLessThan(fold);
    expect(html.indexOf("Alpha A.")).toBeGreaterThan(fold);
  });

  it("keeps a card in the fold while its MIN is typed above 0", () => {
    const html = render(rows.map(r => (r.playerId === "a" ? { ...r, min: 1 } : r)));
    expect(html.indexOf("Alpha A.")).toBeGreaterThan(html.indexOf("t play (1)"));
  });

  it("sums up a line without opening the card", () => {
    expect(render()).toContain("11 PTS · 5 REB · 1 AST");
  });

  it("edits every saved stat, and nothing the save drops", () => {
    const html = render();
    for (const label of ["MIN", "PTS", "REB", "ORB", "DRB", "AST", "STL", "BLK", "TOV", "PF", "2PM", "2PA", "3PM", "3PA", "FTM", "FTA"])
      expect(html).toContain(`>${label}</span>`);
    for (const label of ["EFF", "FGM", "FGA"])
      expect(html).not.toContain(`>${label}</span>`);
  });
});
