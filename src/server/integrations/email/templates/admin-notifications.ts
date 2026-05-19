import "@/server/_internal/node-only";
import { esc, formatDate, type ImportNotificationResult } from "./shared";
import { adminHtml } from "./admin-layout";

export function buildImportSuccess(p: {
  opponent:      string;
  location:      string;
  scheduledFor:  string;
  importedAt:    Date;
  broadcastLink?: string;
}): ImportNotificationResult {
  const vsAt    = p.location === "home" ? "vs" : "@";
  const subject = `[AK] Imported: ${vsAt} ${p.opponent}`;
  const broadcastBlock = p.broadcastLink
    ? `<div style="margin-top:20px;padding:16px 18px;background:#ecfdf5;border-left:3px solid #10b981;border-radius:0 6px 6px 0;">
         <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.08em;">Broadcast to subscribers</p>
         <p style="margin:0 0 10px;font-size:13px;color:#065f46;line-height:1.5;">Review the parsed box score on the next page, then confirm to send the recap email to all confirmed subscribers.</p>
         <a href="${esc(p.broadcastLink)}" style="display:inline-block;padding:10px 22px;background:#10b981;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;border-radius:6px;">Review &amp; broadcast &rarr;</a>
       </div>`
    : "";
  const html = adminHtml({
    title:       "Game Imported",
    accentColor: "#4caf50",
    rows: [
      { label: "Match",      value: `${vsAt} ${esc(p.opponent)}` },
      { label: "Scheduled",  value: esc(formatDate(p.scheduledFor)) },
      { label: "Imported at",value: esc(p.importedAt.toUTCString()) },
    ],
    extra: broadcastBlock,
  });
  const broadcastText = p.broadcastLink
    ? `\n\nBroadcast to subscribers (review then confirm):\n${p.broadcastLink}`
    : "";
  const text = `[AK] Game Imported\n\nMatch: ${vsAt} ${p.opponent}\nScheduled: ${p.scheduledFor}\nImported at: ${p.importedAt.toISOString()}${broadcastText}`;
  return { subject, html, text };
}

export function buildImportFailure(p: {
  opponent:     string;
  location:     string;
  scheduledFor: string;
  attempts:     number;
  lastError:    string | null;
  matchReason?: string | null;
}): ImportNotificationResult {
  const vsAt    = p.location === "home" ? "vs" : "@";
  const subject = `[AK] Import failed: ${vsAt} ${p.opponent}`;
  const errorNote = p.lastError
    ? `<div style="margin-top:16px;padding:12px 16px;background:#fef2f2;border-left:3px solid #c92a2a;border-radius:0 6px 6px 0;font-size:13px;color:#7f1d1d;font-family:monospace;">${esc(p.lastError)}</div>`
    : "";
  const matchReasonNote = p.matchReason
    ? `<p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">Last match attempt: ${esc(p.matchReason)}</p>`
    : "";
  const html = adminHtml({
    title:       "Import Failed",
    accentColor: "#c92a2a",
    rows: [
      { label: "Match",    value: `${vsAt} ${esc(p.opponent)}` },
      { label: "Scheduled",value: esc(formatDate(p.scheduledFor)) },
      { label: "Attempts", value: String(p.attempts) },
    ],
    extra: errorNote + matchReasonNote,
  });
  const text = `[AK] Import Failed\n\nMatch: ${vsAt} ${p.opponent}\nScheduled: ${p.scheduledFor}\nAttempts: ${p.attempts}\nError: ${p.lastError ?? "--"}${p.matchReason ? `\nLast match attempt: ${p.matchReason}` : ""}`;
  return { subject, html, text };
}

export function buildImportAbandoned(p: {
  opponent:     string;
  location:     string;
  scheduledFor: string;
  attempts:     number;
  lastError:    string | null;
  matchReason?: string | null;
}): ImportNotificationResult {
  const vsAt    = p.location === "home" ? "vs" : "@";
  const subject = `[AK] Import abandoned: ${vsAt} ${p.opponent}`;
  const errorNote = p.lastError
    ? `<div style="margin-top:16px;padding:12px 16px;background:#fef2f2;border-left:3px solid #c92a2a;border-radius:0 6px 6px 0;font-size:13px;color:#7f1d1d;font-family:monospace;">${esc(p.lastError)}</div>`
    : "";
  const matchReasonNote = p.matchReason
    ? `<p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">Last match attempt: ${esc(p.matchReason)}</p>`
    : "";
  const html = adminHtml({
    title:       "Import Abandoned",
    accentColor: "#c92a2a",
    rows: [
      { label: "Match",    value: `${vsAt} ${esc(p.opponent)}` },
      { label: "Scheduled",value: esc(formatDate(p.scheduledFor)) },
      { label: "Attempts", value: String(p.attempts) },
    ],
    extra: errorNote + matchReasonNote + `<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">No further automatic attempts will be made. Set the sourceUrl manually and use RUN to retry.</p>`,
  });
  const text = `[AK] Import Abandoned\n\nMatch: ${vsAt} ${p.opponent}\nScheduled: ${p.scheduledFor}\nAttempts: ${p.attempts}\nError: ${p.lastError ?? "--"}${p.matchReason ? `\nLast match attempt: ${p.matchReason}` : ""}\n\nNo further automatic attempts. Set sourceUrl manually and re-run.`;
  return { subject, html, text };
}

