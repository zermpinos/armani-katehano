import { esc, formatDate, type ImportNotificationResult } from "./shared";
import { adminHtml } from "./admin-layout";

export function buildImportSuccess(p: {
  opponent:     string;
  location:     string;
  scheduledFor: string;
  importedAt:   Date;
}): ImportNotificationResult {
  const vsAt    = p.location === "home" ? "vs" : "@";
  const subject = `[AK] Imported: ${vsAt} ${p.opponent}`;
  const html = adminHtml({
    title:       "Game Imported",
    accentColor: "#4caf50",
    rows: [
      { label: "Match",      value: `${vsAt} ${esc(p.opponent)}` },
      { label: "Scheduled",  value: esc(formatDate(p.scheduledFor)) },
      { label: "Imported at",value: esc(p.importedAt.toUTCString()) },
    ],
  });
  const text = `[AK] Game Imported\n\nMatch: ${vsAt} ${p.opponent}\nScheduled: ${p.scheduledFor}\nImported at: ${p.importedAt.toISOString()}`;
  return { subject, html, text };
}

export function buildImportFailure(p: {
  opponent:     string;
  location:     string;
  scheduledFor: string;
  attempts:     number;
  lastError:    string | null;
}): ImportNotificationResult {
  const vsAt    = p.location === "home" ? "vs" : "@";
  const subject = `[AK] Import failed: ${vsAt} ${p.opponent}`;
  const errorNote = p.lastError
    ? `<div style="margin-top:16px;padding:12px 16px;background:#fef2f2;border-left:3px solid #c92a2a;border-radius:0 6px 6px 0;font-size:13px;color:#7f1d1d;font-family:monospace;">${esc(p.lastError)}</div>`
    : "";
  const html = adminHtml({
    title:       "Import Failed",
    accentColor: "#c92a2a",
    rows: [
      { label: "Match",    value: `${vsAt} ${esc(p.opponent)}` },
      { label: "Scheduled",value: esc(formatDate(p.scheduledFor)) },
      { label: "Attempts", value: String(p.attempts) },
    ],
    extra: errorNote,
  });
  const text = `[AK] Import Failed\n\nMatch: ${vsAt} ${p.opponent}\nScheduled: ${p.scheduledFor}\nAttempts: ${p.attempts}\nError: ${p.lastError ?? "—"}`;
  return { subject, html, text };
}

export function buildNoMatchAlert(p: {
  dateStr:      string;
  opponent:     string;
  emailSubject: string;
}): ImportNotificationResult {
  const subject = `[AK] No match: ${p.opponent} (${p.dateStr})`;
  const html = adminHtml({
    title:       "No Matching Game",
    accentColor: "#f59e0b",
    rows: [
      { label: "Opponent",      value: esc(p.opponent) },
      { label: "Date (parsed)", value: esc(p.dateStr) },
      { label: "Email subject", value: esc(p.emailSubject) },
    ],
    extra: `<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">No UpcomingGame matched. Please schedule the game and import manually.</p>`,
  });
  const text = `[AK] No Matching Game\n\nOpponent: ${p.opponent}\nDate: ${p.dateStr}\nEmail subject: "${p.emailSubject}"\n\nNo UpcomingGame matched. Please schedule and import manually.`;
  return { subject, html, text };
}

export function buildNoSourceUrlAlert(p: {
  opponent:       string;
  location:       string;
  scheduledFor:   string;
  upcomingGameId: string;
}): ImportNotificationResult {
  const vsAt    = p.location === "home" ? "vs" : "@";
  const subject = `[AK] No sourceUrl: ${vsAt} ${p.opponent}`;
  const html = adminHtml({
    title:       "sourceUrl Missing",
    accentColor: "#f59e0b",
    rows: [
      { label: "Match",          value: `${vsAt} ${esc(p.opponent)}` },
      { label: "Scheduled",      value: esc(formatDate(p.scheduledFor)) },
      { label: "UpcomingGame ID",value: esc(p.upcomingGameId) },
    ],
    extra: `<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Set the sourceUrl on this game and re-run the import.</p>`,
  });
  const text = `[AK] sourceUrl Missing\n\nMatch: ${vsAt} ${p.opponent}\nScheduled: ${p.scheduledFor}\nUpcomingGame ID: ${p.upcomingGameId}\n\nSet the sourceUrl and re-run import.`;
  return { subject, html, text };
}
