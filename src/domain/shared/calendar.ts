function escIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/[\r\n]+/g, " ");
}

function toCompact(isoStr: string): string {
  return isoStr.replace(/[-:.Z]/g, "").slice(0, 15); // YYYYMMDDTHHmmss
}

function addOneHour(isoStr: string): string {
  const end = new Date(new Date(isoStr).getTime() + 60 * 60 * 1000);
  return toCompact(end.toISOString());
}

export function buildGoogleCalendarUrl(opponent: string, isoStr: string, venue?: string): string {
  const dtStart = toCompact(isoStr);
  const dtEnd   = addOneHour(isoStr);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text:   `Armani Katehano vs ${opponent}`,
    dates:  `${dtStart}/${dtEnd}`,
    ctz:    "Europe/Athens",
    ...(venue ? { location: venue, details: `Venue: ${venue}` } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function buildIcsContent(opponent: string, isoStr: string, venue?: string): string {
  const dtStart   = toCompact(isoStr);
  const dtEnd     = addOneHour(isoStr);
  const title     = `Armani Katehano vs ${opponent}`;
  const description = venue ? `Venue: ${venue}` : "Game";
  const uid       = `${dtStart}-${opponent.replace(/\s+/g, "")}@armanikatehano`;
  const dtstamp   = toCompact(new Date().toISOString()) + "Z";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Armani Katehano//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Athens",
    "BEGIN:STANDARD",
    "DTSTART:19701025T040000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "TZOFFSETFROM:+0300",
    "TZOFFSETTO:+0200",
    "TZNAME:EET",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700329T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0300",
    "TZNAME:EEST",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `DTSTART;TZID=Europe/Athens:${dtStart}`,
    `DTEND;TZID=Europe/Athens:${dtEnd}`,
    `SUMMARY:${escIcs(title)}`,
    `DESCRIPTION:${escIcs(description)}`,
    ...(venue ? [`LOCATION:${escIcs(venue)}`] : []),
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}
