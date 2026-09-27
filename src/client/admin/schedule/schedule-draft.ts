import type { ScheduledGame } from "@/client/admin/shared";

export type ScheduleDraft = {
  opponent:    string;
  date:        string;
  time:        string;
  location:    "home" | "away";
  sourceUrl:   string;
  competition: string;
  notes:       string;
};

export function emptyScheduleDraft(today: string): ScheduleDraft {
  return { opponent: "", date: today, time: "20:00", location: "home", sourceUrl: "", competition: "", notes: "" };
}

// Stored UTC digits are the Athens wall-clock time the admin entered, so the ISO string is sliced, never converted.
export function toScheduleDraft(g: ScheduledGame): ScheduleDraft {
  return {
    opponent:    g.opponent,
    date:        g.scheduledFor.slice(0, 10),
    time:        g.scheduledFor.slice(11, 16),
    location:    g.location,
    sourceUrl:   g.sourceUrl ?? "",
    competition: g.competition ?? "",
    notes:       g.notes ?? "",
  };
}

export function validateScheduleDraft(d: ScheduleDraft): string | null {
  if (!d.opponent.trim()) return "Opponent is required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return "Date is required";
  if (!/^\d{2}:\d{2}$/.test(d.time)) return "Time is required";
  return null;
}

export function toSchedulePayload(d: ScheduleDraft) {
  return {
    opponent:     d.opponent.trim(),
    scheduledFor: `${d.date}T${d.time}:00`,
    location:     d.location,
    competition:  d.competition.trim() || null,
    notes:        d.notes.trim() || null,
    sourceUrl:    d.sourceUrl.trim() || null,
  };
}

export function toScheduledGame(id: string, d: ScheduleDraft): ScheduledGame {
  const p = toSchedulePayload(d);
  return {
    id,
    opponent:     p.opponent,
    scheduledFor: `${p.scheduledFor}.000Z`,
    location:     p.location,
    competition:  p.competition,
    notes:        p.notes,
    sourceUrl:    p.sourceUrl,
  };
}

export function isPlayed(g: ScheduledGame, now = Date.now()): boolean {
  return Date.parse(g.scheduledFor) < now;
}

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
