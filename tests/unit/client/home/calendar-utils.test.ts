// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCountdownInfo, WEBCAL_FEED_URL, GOOGLE_FEED_URL, buildGoogleCalendarUrl, downloadIcsFile,
} from "@/client/home/calendar-utils";

describe("getCountdownInfo", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("labels game as 'Today' when current Athens day == game's stored-Athens day, even when real UTC has flipped", () => {
    // Real UTC: 27/06 22:39Z  =>  Athens (UTC+3 EEST): 28/06 01:39
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-27T22:39:00.000Z"));

    // Stored convention: UTC digits == Athens digits.
    // "2026-06-28T22:30:00Z" means Athens 28/06 at 22:30.
    const r = getCountdownInfo("2026-06-28T22:30:00.000Z");
    expect(r.label).toBe("Today at 22:30");
    expect(r.tier).toBe("today");
  });

  it("labels game as 'Tomorrow' when game's Athens day is one ahead of current Athens day", () => {
    // Real UTC: 28/06 12:00Z  =>  Athens: 28/06 15:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T12:00:00.000Z"));

    const r = getCountdownInfo("2026-06-29T20:00:00.000Z");
    expect(r.label).toBe("Tomorrow at 20:00");
    expect(r.tier).toBe("week");
  });
});

// A subscribe button that hands over the wrong scheme fails silently: the
// browser just does nothing when the link is clicked.
describe("season feed links", () => {
  it("hands the feed to Apple and Outlook over webcal", () => {
    expect(WEBCAL_FEED_URL).toMatch(/^webcal:\/\/[^/]+\/api\/calendar\/games\.ics$/);
  });

  it("hands the same feed to Google as an encoded cid", () => {
    expect(GOOGLE_FEED_URL).toBe(
      `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(WEBCAL_FEED_URL)}`,
    );
  });
});

describe("single-game calendar links", () => {
  const LATE = "2026-11-14T23:30:00.000Z";

  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("ends a 23:30 game at 00:30 the next day in the Google link", () => {
    const dates = new URL(buildGoogleCalendarUrl("Sharks", LATE)).searchParams.get("dates");
    expect(dates).toBe("20261114T233000/20261115T003000");
  });

  it("downloads an .ics file with a valid end time and an escaped venue", async () => {
    let blob;
    vi.stubGlobal("document", { createElement: () => ({ click() {} }), body: { appendChild() {}, removeChild() {} } });
    vi.spyOn(URL, "createObjectURL").mockImplementation((b) => { blob = b; return "blob:test"; });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    downloadIcsFile("Sharks", LATE, "Hall 2, Ilion");
    const ics = await blob.text();
    expect(ics).toContain("DTEND;TZID=Europe/Athens:20261115T003000");
    expect(ics).toContain("LOCATION:Hall 2\\, Ilion");
  });
});
