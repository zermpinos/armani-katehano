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
