import { SITE_NAME } from "@/domain/shared/constants";

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

const VTIMEZONE = [
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
];

// A stored kick-off is Athens wall clock in UTC digits, so the digits go out as
// written and TZID=Europe/Athens tells the client what they mean.
function vevent(
  { uid, summary, isoStr, venue, dtstamp }:
  { uid: string; summary: string; isoStr: string; venue?: string; dtstamp: string },
): string[] {
  return [
    "BEGIN:VEVENT",
    `DTSTART;TZID=Europe/Athens:${toCompact(isoStr)}`,
    `DTEND;TZID=Europe/Athens:${addOneHour(isoStr)}`,
    `SUMMARY:${escIcs(summary)}`,
    `DESCRIPTION:${escIcs(venue ? `Venue: ${venue}` : "Game")}`,
    ...(venue ? [`LOCATION:${escIcs(venue)}`] : []),
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    "END:VEVENT",
  ];
}

export function buildGoogleCalendarUrl(opponent: string, isoStr: string, venue?: string): string {
  const dtStart = toCompact(isoStr);
  const dtEnd   = addOneHour(isoStr);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text:   `${SITE_NAME} vs ${opponent}`,
    dates:  `${dtStart}/${dtEnd}`,
    ctz:    "Europe/Athens",
    ...(venue ? { location: venue, details: `Venue: ${venue}` } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function buildIcsContent(opponent: string, isoStr: string, venue?: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Armani Katehano//EN",
    "CALSCALE:GREGORIAN",
    ...VTIMEZONE,
    ...vevent({
      uid:     `${toCompact(isoStr)}-${opponent.replace(/\s+/g, "")}@armanikatehano`,
      summary: `${SITE_NAME} vs ${opponent}`,
      isoStr,
      venue,
      dtstamp: toCompact(new Date().toISOString()) + "Z",
    }),
    "END:VCALENDAR",
  ].join("\r\n");
}

export type FeedGame = {
  id:           string;
  opponent:     string;
  scheduledFor: string;
  location?:    string | null;
  notes?:       string | null;
};

// The whole schedule as one calendar, subscribed to once. UIDs are row ids, so
// a fixture the sync reschedules moves in the subscriber's calendar rather than
// arriving as a second event. With no fixtures the VTIMEZONE still stands as a
// component, which is what keeps an empty feed a valid VCALENDAR.
export function buildIcsFeed(games: FeedGame[]): string {
  const dtstamp = toCompact(new Date().toISOString()) + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Armani Katehano//EN",
    "CALSCALE:GREGORIAN",
    // A PUBLISH message has to carry at least one event, and between rounds
    // there are none. Left out then, so an empty schedule reads as a calendar
    // with nothing in it rather than a publication a client can reject.
    ...(games.length ? ["METHOD:PUBLISH"] : []),
    `X-WR-CALNAME:${escIcs(SITE_NAME)}`,
    "X-WR-TIMEZONE:Europe/Athens",
    // A hint, not a contract: Apple and Outlook follow it, Google refreshes on
    // its own schedule, so a reschedule can take a day to reach a Google user.
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...VTIMEZONE,
    ...games.flatMap(g => vevent({
      uid:     `${g.id}@armani-katehano.com`,
      summary: `${SITE_NAME} ${g.location === "away" ? "@" : "vs"} ${g.opponent}`,
      isoStr:  g.scheduledFor,
      venue:   g.notes ?? undefined,
      dtstamp,
    })),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
