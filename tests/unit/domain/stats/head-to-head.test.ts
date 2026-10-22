import { describe, it, expect } from "vitest";
import { headToHead, headToHeadAll, meetingCount, opponentSlug, recordText, type MeetingSource } from "@/domain/stats/head-to-head";

const g = (id: string, date: string, opponent: string, result: string, score = "60-50"): MeetingSource =>
  ({ id, date, opponent, home: true, result, score, season: date < "2026-07-01" ? "2025-26" : "2026-27", leagueName: "Winter Cup" });

const games = [
  g("a", "2026-09-12", "New York Bricks", "W", "68-61"),
  g("b", "2025-11-02", "New York Bricks", "L", "55-60"),
  g("c", "2026-01-20", "New York Bricks", "W"),
  g("d", "2026-03-15", "New York Bricks", "W"),
  g("e", "2026-09-19", "Atalantoi Hawks", "W"),
];

describe("opponentSlug", () => {
  it("lowercases and joins letters and digits with dashes", () => {
    expect(opponentSlug("B.C. Abla")).toBe("b-c-abla");
    expect(opponentSlug("New York Bricks")).toBe("new-york-bricks");
    expect(opponentSlug("The 90s")).toBe("the-90s");
  });
});

describe("headToHead", () => {
  it("counts every meeting and lists the newest first, up to the limit", () => {
    const h = headToHead(games, "New York Bricks", { limit: 3 });
    expect([h.wins, h.losses, h.ties]).toEqual([3, 1, 0]);
    expect(h.meetings.map(m => m.id)).toEqual(["a", "d", "c"]);
    expect(h.meetings[0]).toEqual({ id: "a", date: "2026-09-12", season: "2026-27", competition: "Winter Cup", result: "W", score: "68-61" });
    expect(h.slug).toBe("new-york-bricks");
  });

  it("counts only games before a date when asked", () => {
    const h = headToHead(games, "New York Bricks", { before: "2026-03-15" });
    expect(h.meetings.map(m => m.id)).toEqual(["c", "b"]);
    expect([h.wins, h.losses]).toEqual([1, 1]);
  });

  it("keeps the last five results, newest first, whatever the limit", () => {
    const more = [...games, g("f", "2025-10-01", "New York Bricks", "T"), g("h", "2025-09-01", "New York Bricks", "L")];
    const h = headToHead(more, "New York Bricks", { limit: 3 });
    expect(h.meetings).toHaveLength(3);
    expect(h.form).toEqual(["W", "W", "W", "L", "T"]);
  });

  it("takes the form only from games before a date when asked", () => {
    expect(headToHead(games, "New York Bricks", { before: "2026-03-15" }).form).toEqual(["W", "L"]);
  });

  it("is empty for a team never played", () => {
    expect(headToHead(games, "Delulu")).toMatchObject({ wins: 0, losses: 0, ties: 0, form: [], meetings: [] });
  });
});

describe("headToHeadAll", () => {
  it("summarises every opponent played", () => {
    const all = headToHeadAll(games, 3);
    expect(all.map(h => h.opponent).sort()).toEqual(["Atalantoi Hawks", "New York Bricks"]);
    expect(all.find(h => h.opponent === "New York Bricks")!.meetings).toHaveLength(3);
  });
});

describe("recordText", () => {
  it("shows ties only when there are some", () => {
    expect(recordText(headToHead(games, "New York Bricks"))).toBe("3-1");
    expect(recordText({ ...headToHead(games, "New York Bricks"), ties: 1 })).toBe("3-1-1");
  });
});

describe("meetingCount", () => {
  it("counts every meeting, not only the listed ones", () => {
    const h = headToHead(games, "New York Bricks", { limit: 1 });
    expect(h.meetings).toHaveLength(1);
    expect(meetingCount(h)).toBe(4);
    expect(meetingCount({ ...h, ties: 2 })).toBe(6);
  });
});
