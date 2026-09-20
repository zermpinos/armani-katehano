import { describe, it, expect } from "vitest";
import { buildGoogleCalendarUrl, buildIcsContent, buildIcsFeed } from "@/domain/shared/calendar";

const ISO = "2026-05-16T18:00:00.000Z";

describe("buildGoogleCalendarUrl", () => {
  it("returns a well-formed Google Calendar URL", () => {
    const url = buildGoogleCalendarUrl("Dragons", ISO);
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("Armani+Katehano+vs+Dragons");
    expect(url).toContain("ctz=Europe%2FAthens");
  });

  it("includes venue when provided", () => {
    const url = buildGoogleCalendarUrl("Dragons", ISO, "Arena X");
    expect(url).toContain("Arena+X");
    expect(url).toContain("location=");
    expect(url).toContain("details=");
  });

  it("omits location and details when venue is absent", () => {
    const url = buildGoogleCalendarUrl("Dragons", ISO);
    expect(url).not.toContain("location=");
    expect(url).not.toContain("details=");
  });

  it("computes end time one hour after start", () => {
    const url = buildGoogleCalendarUrl("Dragons", ISO);
    // ISO 18:00 -> dtStart contains T180000, dtEnd contains T190000
    expect(url).toContain("T180000");
    expect(url).toContain("T190000");
  });
});

describe("buildIcsContent", () => {
  it("returns a valid VCALENDAR string", () => {
    const ics = buildIcsContent("Dragons", ISO);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("SUMMARY:Armani Katehano vs Dragons");
  });

  it("includes LOCATION line when venue is provided", () => {
    const ics = buildIcsContent("Dragons", ISO, "Arena X");
    expect(ics).toContain("LOCATION:Arena X");
  });

  it("omits LOCATION line when venue is absent", () => {
    const ics = buildIcsContent("Dragons", ISO);
    expect(ics).not.toContain("LOCATION:");
  });

  it("escapes ICS special characters in SUMMARY", () => {
    const ics = buildIcsContent("Team, Red; Blue\\Slash", ISO);
    expect(ics).toContain("SUMMARY:Armani Katehano vs Team\\, Red\\; Blue\\\\Slash");
  });

  it("uses CRLF line endings", () => {
    const ics = buildIcsContent("Dragons", ISO);
    expect(ics).toContain("\r\n");
  });
});

describe("buildIcsFeed", () => {
  const GAMES = [
    { id: "ug1", opponent: "Dragons", scheduledFor: "2026-09-19T16:15:00.000Z", location: "home", notes: "Arena X" },
    { id: "ug2", opponent: "Hawks",   scheduledFor: "2026-09-26T21:30:00.000Z", location: "away", notes: null },
  ];

  it("puts every fixture in one calendar with a single timezone block", () => {
    const ics = buildIcsFeed(GAMES);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/BEGIN:VTIMEZONE/g)).toHaveLength(1);
    expect(ics).toContain("X-WR-CALNAME:Armani Katehano");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  // Stored times are Athens digits, so the feed has to print them untouched.
  // Converting here would put every subscribed game two or three hours early.
  it("publishes the stored clock digits as Athens time", () => {
    const ics = buildIcsFeed(GAMES);
    expect(ics).toContain("DTSTART;TZID=Europe/Athens:20260919T161500");
    expect(ics).toContain("DTEND;TZID=Europe/Athens:20260919T171500");
  });

  it("rolls an end time past midnight onto the next day", () => {
    const ics = buildIcsFeed(GAMES);
    expect(ics).toContain("DTSTART;TZID=Europe/Athens:20260926T213000");
    expect(ics).toContain("DTEND;TZID=Europe/Athens:20260926T223000");
  });

  // The row id, so a rescheduled fixture moves in a subscriber's calendar
  // instead of turning up twice.
  it("keys each event on the fixture row", () => {
    const ics = buildIcsFeed(GAMES);
    expect(ics).toContain("UID:ug1@armani-katehano.com");
    expect(ics).toContain("UID:ug2@armani-katehano.com");
  });

  it("reads home and away the way the site does", () => {
    const ics = buildIcsFeed(GAMES);
    expect(ics).toContain("SUMMARY:Armani Katehano vs Dragons");
    expect(ics).toContain("SUMMARY:Armani Katehano @ Hawks");
  });

  it("carries the venue and skips the line when there is none", () => {
    const ics = buildIcsFeed(GAMES);
    expect(ics.match(/LOCATION:/g)).toHaveLength(1);
    expect(ics).toContain("LOCATION:Arena X");
  });

  // The season starts with nothing scheduled, and the timezone block is what
  // keeps that a calendar a client will accept rather than an empty file.
  it("stays a valid calendar with no fixtures at all", () => {
    const ics = buildIcsFeed([]);
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
