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

// Its own kind rather than a borrowed one. Dressing a test as a success posts
// something indistinguishable from a real import, and dressing it as a stall
// raises a false alarm; either teaches the channel to be ignored.
export function buildImportTest(): ImportNotificationResult {
  const subject = "[AK] Alert path test";
  const html = adminHtml({
    title:       "Alert Path Test",
    accentColor: "#4caf50",
    rows: [{ label: "Triggered", value: "By hand from the admin" }],
    extra: "",
  });
  const text = "[AK] Alert Path Test\n\nSent by hand from the admin to check where import alerts arrive. No game was imported and nothing is wrong.";
  return { subject, html, text };
}

const CELL = "margin-top:10px;padding:10px 12px;background:#fef2f2;border-left:3px solid #c92a2a;border-radius:0 6px 6px 0;font-size:12px;color:#7f1d1d;word-break:break-all;";

export function buildImportStalled(p: {
  entries: { sourceUrl: string; reason: string }[];
  error?:  string | null;
}): ImportNotificationResult {
  const n       = p.entries.length;
  const subject = p.error
    ? "[AK] Import poll failed"
    : `[AK] Import poll stuck on ${n} game${n === 1 ? "" : "s"}`;

  const list = p.entries
    .map(e => `<div style="${CELL}">${esc(e.sourceUrl.slice(0, 300))}<br/><strong>${esc(e.reason.slice(0, 200))}</strong></div>`)
    .join("");
  const errorNote = p.error
    ? `<div style="${CELL}font-family:monospace;">${esc(p.error.slice(0, 300))}</div>`
    : "";

  const html = adminHtml({
    title:       p.error ? "Import Poll Failed" : "Import Poll Stuck",
    accentColor: "#c92a2a",
    rows: p.error
      ? [{ label: "Outcome", value: "The run threw before it finished" }]
      : [{ label: "Games waiting", value: String(n) }],
    extra: list + errorNote,
  });

  const lines = p.entries.map(e => `- ${e.sourceUrl}\n  ${e.reason}`).join("\n");
  const text = p.error
    ? `[AK] Import Poll Failed\n\nThe run threw before it finished.\n${p.error}`
    : `[AK] Import Poll Stuck\n\n${n} game(s) did not import:\n\n${lines}`;

  return { subject, html, text };
}
