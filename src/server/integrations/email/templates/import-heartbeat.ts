import "@/server/_internal/node-only";
import { esc } from "./shared";

export interface HeartbeatRun {
  startedAt: Date;
  ok:        boolean;
  summary:   Record<string, unknown> | null;
  error:     string | null;
}

export interface HeartbeatGame {
  opponent:     string;
  scheduledFor: Date;
  hasListing:   boolean;
  jobState:     string | null;
  attempts:     number;
  lastError:    string | null;
}

export interface HeartbeatPayload {
  windowStart:    Date;
  windowEnd:      Date;
  runs:           HeartbeatRun[];
  inWindow:       HeartbeatGame[];     // games in the active 7-day backfill window
  dropouts:       HeartbeatGame[];     // games that fell out of the window without a terminal state
  upcomingNext7d: HeartbeatGame[];     // future games, flag-missing-listingUrl
}

export function buildImportHeartbeat(p: HeartbeatPayload): { subject: string; html: string; text: string } {
  const ok      = p.runs.filter(r => r.ok).length;
  const failed  = p.runs.length - ok;
  const subject = `Auto-import heartbeat — ${ok}/${p.runs.length} OK${p.dropouts.length > 0 ? ` · ${p.dropouts.length} DROPOUT(s)` : ""}`;

  const fmtDate = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ") + " UTC";

  const sectionGames = (title: string, games: HeartbeatGame[], emptyMsg: string, emphasize = false): { html: string; text: string } => {
    const colour = emphasize ? "#c92a2a" : "#374151";
    if (games.length === 0) {
      return {
        html: `<h3 style="margin:24px 0 8px;font-size:14px;color:${colour};">${esc(title)}</h3><p style="margin:0;color:#9ca3af;font-size:12px;">${esc(emptyMsg)}</p>`,
        text: `\n${title}\n  ${emptyMsg}\n`,
      };
    }
    const rowsHtml = games.map(g => `
      <tr>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px;">${esc(g.opponent)}</td>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px;">${fmtDate(g.scheduledFor)}</td>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px;">${g.hasListing ? "✓" : "<strong style=\"color:#c92a2a\">missing</strong>"}</td>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px;">${esc(g.jobState ?? "—")}${g.attempts > 0 ? ` ×${g.attempts}` : ""}</td>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;">${esc(g.lastError ?? "")}</td>
      </tr>`).join("");
    const rowsText = games.map(g =>
      `  ${fmtDate(g.scheduledFor)} · ${g.opponent} · listing=${g.hasListing ? "yes" : "MISSING"} · job=${g.jobState ?? "—"}${g.attempts > 0 ? ` ×${g.attempts}` : ""}${g.lastError ? `\n    err: ${g.lastError}` : ""}`
    ).join("\n");
    return {
      html: `<h3 style="margin:24px 0 8px;font-size:14px;color:${colour};">${esc(title)} (${games.length})</h3>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          <tr>
            <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Opponent</th>
            <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Scheduled</th>
            <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Listing</th>
            <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Job</th>
            <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Last error</th>
          </tr>
          ${rowsHtml}
        </table>`,
      text: `\n${title} (${games.length})\n${rowsText}\n`,
    };
  };

  const inWin    = sectionGames("Active window (last 7 days)", p.inWindow, "no candidates");
  const drops    = sectionGames("DROPOUTS — fell out of window without import or abandon", p.dropouts, "none — clean", true);
  const next7d   = sectionGames("Next 7 days schedule", p.upcomingNext7d, "no upcoming games");

  const runsHtml = p.runs.length === 0
    ? `<p style="margin:0;color:#9ca3af;font-size:12px;">no runs in the last 24 h</p>`
    : `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
        <tr>
          <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;">When</th>
          <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;">Status</th>
          <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;">Summary / Error</th>
        </tr>
        ${p.runs.map(r => `<tr>
          <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px;">${fmtDate(r.startedAt)}</td>
          <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px;color:${r.ok ? "#15803d" : "#c92a2a"};font-weight:700;">${r.ok ? "OK" : "FAIL"}</td>
          <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:11px;color:#374151;">${esc(r.error ?? JSON.stringify(r.summary ?? {}))}</td>
        </tr>`).join("")}
      </table>`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c92a2a;">ARMANI KATEHANO</p>
      <h1 style="margin:8px 0 4px;font-size:20px;font-weight:900;">Auto-import heartbeat</h1>
      <p style="margin:0;font-size:12px;color:#6b7280;">Last 24 h: ${ok} OK, ${failed} failed</p>

      <h3 style="margin:24px 0 8px;font-size:14px;">Runs</h3>
      ${runsHtml}

      ${inWin.html}
      ${drops.html}
      ${next7d.html}
    </div>
  </body></html>`;

  const text = `ARMANI KATEHANO
Auto-import heartbeat
Last 24 h: ${ok} OK, ${failed} failed

Runs
${p.runs.length === 0
  ? "  no runs in the last 24 h"
  : p.runs.map(r => `  ${fmtDate(r.startedAt)} · ${r.ok ? "OK" : "FAIL"} · ${r.error ?? JSON.stringify(r.summary ?? {})}`).join("\n")}

${inWin.text}${drops.text}${next7d.text}`;

  return { subject, html, text };
}
