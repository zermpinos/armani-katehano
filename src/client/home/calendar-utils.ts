import { fmtDate } from "@/domain/shared/format";

const ATHENS_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Athens",
  year: "numeric", month: "2-digit", day: "2-digit",
});

function athensDayStartUtc(d: Date): number {
  const [y, m, day] = ATHENS_YMD.format(d).split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

export function getCountdownInfo(isoStr: string): { label: string; tier: "today" | "week" | "future" } {
  const gameTime = new Date(isoStr);
  // Stored convention: UTC digits == Athens digits. So game-side UTC accessors
  // give Athens digits directly. For `now`, we have to convert real-UTC to the
  // current Athens calendar day, or near-midnight crossings give a 1-day skew.
  const todayStart = athensDayStartUtc(new Date());
  const gameDay    = Date.UTC(gameTime.getUTCFullYear(), gameTime.getUTCMonth(), gameTime.getUTCDate());
  const daysUntil  = Math.ceil((gameDay - todayStart) / 86400000);
  const fmtTime    = () => isoStr.slice(11, 16);
  if (daysUntil === 0) return { label: `Today at ${fmtTime()}`, tier: "today" };
  if (daysUntil === 1) return { label: `Tomorrow at ${fmtTime()}`, tier: "week" };
  if (daysUntil <= 6)  return { label: `In ${daysUntil} days`, tier: "week" };
  return { label: fmtDate(isoStr), tier: "future" };
}

export function formatGameTime(isoStr: string): string {
  return isoStr.slice(11, 16);
}

export function downloadIcsFile(opponent: string, isoStr: string, venue?: string): void {
  const dtStart = isoStr.replace(/[-:]/g, "").split(".")[0];
  const [datePart, timePart] = isoStr.split("T");
  const [hh, mm, ss] = timePart.split(":");
  const endHH = String(parseInt(hh) + 1).padStart(2, "0");
  const dtEnd = `${datePart.replace(/-/g, "")}T${endHH}${mm}${ss || "00"}`;
  const title = `Armani Katehano vs ${opponent}`;
  const description = venue ? `Venue: ${venue}` : "Game";
  const uid = `${dtStart}-${opponent.replace(/\s+/g, "")}@armanikatehano`;
  const ical = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Armani Katehano//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE", "TZID:Europe/Athens",
    "BEGIN:STANDARD", "DTSTART:19701025T040000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "TZOFFSETFROM:+0300", "TZOFFSETTO:+0200", "TZNAME:EET", "END:STANDARD",
    "BEGIN:DAYLIGHT", "DTSTART:19700329T030000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "TZOFFSETFROM:+0200", "TZOFFSETTO:+0300", "TZNAME:EEST", "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `DTSTART;TZID=Europe/Athens:${dtStart}`,
    `DTEND;TZID=Europe/Athens:${dtEnd}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    venue ? `LOCATION:${venue}` : "",
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const blob = new Blob([ical], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Armani-Katehano-vs-${opponent.replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildGoogleCalendarUrl(opponent: string, isoStr: string, venue?: string): string {
  const dtStart = isoStr.replace(/[-:]/g, "").split(".")[0];
  const [datePart, timePart] = isoStr.split("T");
  const [hh, mm] = timePart.split(":");
  const endHH = String(parseInt(hh) + 1).padStart(2, "0");
  const dtEnd = `${datePart.replace(/-/g, "")}T${endHH}${mm}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Armani Katehano vs ${opponent}`,
    dates: `${dtStart}/${dtEnd}`,
    ctz: "Europe/Athens",
    ...(venue ? { location: venue, details: `Venue: ${venue}` } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
