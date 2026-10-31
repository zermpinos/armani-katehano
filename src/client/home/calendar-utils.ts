import { fmtDate } from "@/domain/shared/format";
import { buildIcsContent } from "@/domain/shared/calendar";

export { buildGoogleCalendarUrl } from "@/domain/shared/calendar";

const ATHENS_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Athens",
  year: "numeric", month: "2-digit", day: "2-digit",
});

function athensDayStartUtc(d: Date): number {
  const [y, m, day] = ATHENS_YMD.format(d).split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

// The whole schedule as one subscription, so a fan adds it once instead of
// per game. NEXT_PUBLIC_ values are inlined at build time.
const FEED_URL = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://armani-katehano.com"}/api/calendar/games.ics`;
export const WEBCAL_FEED_URL = FEED_URL.replace(/^https?:/, "webcal:");
export const GOOGLE_FEED_URL = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(WEBCAL_FEED_URL)}`;

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
  const blob = new Blob([buildIcsContent(opponent, isoStr, venue)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Armani-Katehano-vs-${opponent.replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
