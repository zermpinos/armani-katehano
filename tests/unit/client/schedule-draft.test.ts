import { describe, it, expect } from "vitest";
import {
  emptyScheduleDraft, toScheduleDraft, validateScheduleDraft,
  toSchedulePayload, toScheduledGame, isPlayed, todayIso,
} from "@/client/admin/schedule/schedule-draft";

const row = {
  id: "cmfixture0000000000000001", opponent: "Panathinaikos", scheduledFor: "2026-10-01T20:30:00.000Z",
  location: "away" as const, competition: "Super Cup", notes: null, sourceUrl: null,
};

describe("schedule draft", () => {
  it("reads the stored digits as the Athens wall-clock time, without conversion", () => {
    const d = toScheduleDraft(row);
    expect(d.date).toBe("2026-10-01");
    expect(d.time).toBe("20:30");
    expect(d.competition).toBe("Super Cup");
    expect(d.notes).toBe("");
  });

  it("writes a zone-less time so the server keeps the same digits", () => {
    expect(toSchedulePayload(toScheduleDraft(row)).scheduledFor).toBe("2026-10-01T20:30:00");
  });

  it("builds the optimistic row in the same shape GET returns", () => {
    expect(toScheduledGame(row.id, toScheduleDraft(row))).toEqual(row);
  });

  it("sends blanks as null and trims text", () => {
    const p = toSchedulePayload({ ...emptyScheduleDraft("2026-10-01"), opponent: "  Aris  " });
    expect(p).toEqual({ opponent: "Aris", scheduledFor: "2026-10-01T20:00:00", location: "home", competition: null, notes: null, sourceUrl: null });
  });

  it("requires an opponent, a date and a time", () => {
    const base = emptyScheduleDraft("2026-10-01");
    expect(validateScheduleDraft(base)).toBe("Opponent is required");
    expect(validateScheduleDraft({ ...base, opponent: "Aris", date: "" })).toBe("Date is required");
    expect(validateScheduleDraft({ ...base, opponent: "Aris", time: "" })).toBe("Time is required");
    expect(validateScheduleDraft({ ...base, opponent: "Aris" })).toBeNull();
  });

  it("treats a fixture as played once its time has passed", () => {
    const now = Date.parse("2026-10-02T00:00:00.000Z");
    expect(isPlayed(row, now)).toBe(true);
    expect(isPlayed({ ...row, scheduledFor: "2026-10-09T20:30:00.000Z" }, now)).toBe(false);
  });

  it("gives today's local date as YYYY-MM-DD", () => {
    expect(todayIso(new Date(2026, 8, 7))).toBe("2026-09-07");
  });
});
