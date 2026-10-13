import { describe, it, expect } from "vitest";
import { entriesFrom, reassign, eligiblePlayers } from "@/client/admin/import/line-assign";
import { ZERO_ROW } from "@/domain/import/resolve";

const borrowed = { ...ZERO_ROW, min: 23.35, pts: 11, reb: 5, orb: 3, drb: 2, pf: 4 };
const guest    = { ...ZERO_ROW, min: 10, pts: 4, reb: 1, drb: 1 };
const box = () => [
  { playerId: "owner",    ...borrowed },
  { playerId: "borrower", ...ZERO_ROW },
  { playerId: "bench",    ...ZERO_ROW },
];
const [mismatch]   = entriesFrom([], [{ number: 0, scrapedName: "BORROWER", playerId: "owner" }]);
const [unassigned] = entriesFrom([{ number: 44, name: "GUEST", line: guest }], []);

describe("entriesFrom", () => {
  it("lists unassigned jerseys first, and starts a borrowed one on its owner", () => {
    expect(entriesFrom(
      [{ number: 44, name: "GUEST", line: guest }],
      [{ number: 0, scrapedName: "BORROWER", playerId: "owner" }],
    )).toEqual([
      { number: 44, scrapedName: "GUEST",    ownerId: null,    assignee: null,    line: guest },
      { number: 0,  scrapedName: "BORROWER", ownerId: "owner", assignee: "owner", line: null },
    ]);
  });
});

describe("reassign", () => {
  it("moves a borrowed jersey's whole line, hidden stats included, and zeroes the owner", () => {
    const { box: next, entry } = reassign(box(), mismatch, "borrower");
    expect(next.find(r => r.playerId === "borrower")).toEqual({ playerId: "borrower", ...borrowed });
    expect(next.find(r => r.playerId === "owner")).toEqual({ playerId: "owner", ...ZERO_ROW });
    expect(next).toHaveLength(3);
    expect(entry.assignee).toBe("borrower");
  });

  it("moves it again from wherever it sits, edits included", () => {
    const first  = reassign(box(), mismatch, "borrower");
    const edited = first.box.map(r => (r.playerId === "borrower" ? { ...r, pts: 12 } : r));
    const second = reassign(edited, first.entry, "bench");
    expect(second.box.find(r => r.playerId === "bench")?.pts).toBe(12);
    expect(second.box.find(r => r.playerId === "borrower")).toEqual({ playerId: "borrower", ...ZERO_ROW });
  });

  it("gives an unassigned jersey's line to an existing player's row", () => {
    const { box: next, entry } = reassign(box(), unassigned, "bench");
    expect(next.find(r => r.playerId === "bench")).toEqual({ playerId: "bench", ...guest });
    expect(next).toHaveLength(3);
    expect(entry).toMatchObject({ assignee: "bench", line: null });
  });

  it("takes the line back off the row when set to nobody", () => {
    const placed = reassign(box(), unassigned, "bench");
    const { box: next, entry } = reassign(placed.box, placed.entry, null);
    expect(next.find(r => r.playerId === "bench")).toEqual({ playerId: "bench", ...ZERO_ROW });
    expect(entry.assignee).toBeNull();
    expect(entry.line).toMatchObject(guest);
  });
});

describe("eligiblePlayers", () => {
  it("offers players with no minutes yet, plus whoever holds the line now", () => {
    const players = ["owner", "borrower", "bench", "starter"].map((id, i) => ({ id, name: id, number: i, position: "G" }));
    const rows = [...box(), { playerId: "starter", ...ZERO_ROW, min: 30, pts: 6 }];
    expect(eligiblePlayers(players, rows, mismatch, [mismatch]).map(p => p.id)).toEqual(["owner", "borrower", "bench"]);
  });

  it("never offers someone holding another jersey's line, even after their MIN is edited to 0", () => {
    const players = ["owner", "borrower", "bench"].map((id, i) => ({ id, name: id, number: i, position: "G" }));
    const moved   = reassign(box(), mismatch, "borrower");
    const edited  = moved.box.map(r => (r.playerId === "borrower" ? { ...r, min: 0 } : r));
    expect(eligiblePlayers(players, edited, unassigned, [moved.entry, unassigned]).map(p => p.id)).toEqual(["owner", "bench"]);
  });
});
