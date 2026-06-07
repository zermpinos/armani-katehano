import "@/server/_internal/node-only";
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
    extra: "",
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
  const text = `[AK] Import Failed\n\nMatch: ${vsAt} ${p.opponent}\nScheduled: ${p.scheduledFor}\nAttempts: ${p.attempts}\nError: ${p.lastError ?? "-"}${p.matchReason ? `\nLast match attempt: ${p.matchReason}` : ""}`;
  return { subject, html, text };
}
