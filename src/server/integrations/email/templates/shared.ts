export interface ImportNotificationResult {
  subject: string;
  html:    string;
  text:    string;
}

export interface PlayerSlot {
  name:   string;
  number: number;
  note:   string | null;
}

export interface Game {
  opponent:     string;
  scheduledFor: string;
  location:     string;
  competition:  string | null;
  notes:        string | null;
}

export interface Subscriber {
  id:    string;
  email: string;
  token: string;
}

export interface SendRosterAnnouncementParams {
  game:        Game;
  players:     PlayerSlot[];
  message?:    string | null;
  subscribers: Subscriber[];
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseIso(iso: string): Date {
  const [datePart, timePart] = iso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

export function formatDate(iso: string): string {
  return parseIso(iso).toLocaleString("el-GR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
}

export function formatDateFull(iso: string): string {
  return parseIso(iso).toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDayTime(iso: string): string {
  const d    = parseIso(iso);
  const day  = d.toLocaleString("en-GB", { weekday: "long", timeZone: "UTC" });
  const time = d.toLocaleString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
  });
  return `${day}, ${time}`;
}

export function sanitize(s: string): string {
  return s.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, 1000);
}
