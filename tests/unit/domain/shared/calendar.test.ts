import { describe, it, expect } from "vitest";
import { buildGoogleCalendarUrl, buildIcsContent } from "@/domain/shared/calendar";

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
    // ISO 18:00 → dtStart contains T180000, dtEnd contains T190000
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
