import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LineAssignments } from "@/client/admin/import/LineAssignments";
import { entriesFrom, type LineEntry } from "@/client/admin/import/line-assign";
import { ZERO_ROW } from "@/domain/import/resolve";

const players = [
  { id: "owner",    name: "Olga Owner",    number: 0, position: "PG" },
  { id: "borrower", name: "Bea Borrower",  number: 1, position: "SG" },
  { id: "starter",  name: "Stan Starter",  number: 8, position: "SF" },
];
const box = [
  { playerId: "owner",    ...ZERO_ROW, min: 23, pts: 11 },
  { playerId: "borrower", ...ZERO_ROW },
  { playerId: "starter",  ...ZERO_ROW, min: 30, pts: 6 },
];
const render = (entries: LineEntry[]) => renderToStaticMarkup(createElement(LineAssignments, {
  entries, players, box, disabled: false, onAssign: () => {}, onCreated: () => {},
}));

describe("LineAssignments", () => {
  it("starts a borrowed jersey on its owner, offers who wore it, and never offers nobody", () => {
    const html = render(entriesFrom([], [{ number: 0, scrapedName: "BORROWER BEA", playerId: "owner" }]));
    expect(html).toContain("PLAYER FOR #0");
    expect(html).toContain('<option value="owner" selected="">#0 Olga Owner</option>');
    expect(html).toContain("#1 Bea Borrower");
    expect(html).not.toContain("#8 Stan Starter");
    expect(html).not.toContain("Nobody yet");
    expect(html).not.toContain("ADD TO ROSTER");
  });

  it("starts an unknown jersey on nobody, and offers to add it to the roster", () => {
    const html = render(entriesFrom([{ number: 44, name: "GUEST NEW", line: { ...ZERO_ROW, min: 10, pts: 4 } }], []));
    expect(html).toContain('<option value="" selected="">Nobody yet</option>');
    expect(html).toContain("ADD TO ROSTER");
  });

  it("renders nothing when every line is settled", () => {
    expect(render([])).toBe("");
  });
});
