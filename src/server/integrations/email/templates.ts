import { getVenueUrl } from "@/domain/shared/venues";

// ─── Admin import notification templates ────────────────────────────────────

export interface ImportNotificationResult {
  subject: string;
  html:    string;
  text:    string;
}

function adminHtml(opts: {
  title:       string;
  accentColor: string;
  rows:        Array<{ label: string; value: string }>;
  extra?:      string;
}): string {
  const rowsHtml = opts.rows.map(r => `
      <tr>
        <td style="padding:8px 0;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;">${r.label}</p>
          <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600;">${r.value}</p>
        </td>
      </tr>`).join("");

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="el">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title} -- Armani Katehano</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#111111;padding:28px 32px;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c92a2a;">ARMANI KATEHANO</p>
              <p style="margin:10px 0 0;font-size:20px;font-weight:900;color:${opts.accentColor};">${opts.title}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rowsHtml}
              </table>
              ${opts.extra ?? ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
  const text = `[AK] Import Failed\n\nMatch: ${vsAt} ${p.opponent}\nScheduled: ${p.scheduledFor}\nAttempts: ${p.attempts}\nError: ${p.lastError ?? "--"}`;
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
  opponent:      string;
  location:      string;
  scheduledFor:  string;
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

// ─── End admin import notification templates ─────────────────────────────────

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

export function formatDate(iso: string): string {
  const [datePart, timePart] = iso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return d.toLocaleString("el-GR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
}

export function sanitize(s: string): string {
  return s.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, 1000);
}

export function buildHtml(
  game: Game,
  players: PlayerSlot[],
  message: string | null | undefined,
  appUrl: string,
  unsubscribeUrl: string,
): string {
  const isHome    = game.location === "home";
  const matchup   = `${isHome ? "vs" : "@"} ${esc(game.opponent)}`;
  const venueLabel = game.notes ? esc(game.notes) : (isHome ? "Home" : "Away");
  const venueUrl   = game.notes ? getVenueUrl(game.notes) : null;
  const dateStr   = esc(formatDate(game.scheduledFor));

  const sorted = [...players].sort((a, b) => a.number - b.number);

  const playerRows = sorted.map((p, i) => {
    const bg   = i % 2 === 0 ? "#ffffff" : "#f9fafb";
    const note = p.note
      ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;letter-spacing:0.06em;">${esc(p.note)}</span>`
      : "";
    return `
      <tr style="background:${bg};">
        <td style="padding:10px 16px;width:44px;font-size:12px;font-weight:900;color:#c92a2a;font-variant-numeric:tabular-nums;">#${p.number}</td>
        <td style="padding:10px 16px;font-size:14px;color:#111827;font-weight:600;">${esc(p.name)}${note}</td>
      </tr>`;
  }).join("");

  const coachBlock = message ? `
    <tr>
      <td style="padding:0 32px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.12em;">Note from the coach</p>
              <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.7;">${esc(sanitize(message))}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : "";

  const competitionRow = game.competition ? `
    <tr>
      <td style="padding:8px 0;border-top:1px solid #f3f4f6;">
        <p style="margin:0;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;">Competition</p>
        <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600;">${esc(game.competition)}</p>
      </td>
    </tr>` : "";

  const preheader = `Roster announced · ${isHome ? "vs" : "@"} ${game.opponent} · ${formatDate(game.scheduledFor)}`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="el">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Roster Announcement -- Armani Katehano</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;-webkit-font-smoothing:antialiased;">

  <!--[if mso]><table width="100%"><tr><td><![endif]-->

  <!-- Preheader -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</span>

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#111111;padding:32px 32px 28px;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c92a2a;">ARMANI KATEHANO</p>
              <p style="margin:10px 0 0;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;line-height:1.2;">Roster Announcement</p>
            </td>
          </tr>

          <!-- Match info -->
          <tr>
            <td style="padding:28px 32px 24px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0 0 20px;font-size:22px;font-weight:900;color:#111827;letter-spacing:-0.01em;">${matchup}</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #f3f4f6;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;">Date</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600;">${dateStr}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #f3f4f6;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;">Venue</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600;">${venueUrl ? `<a href="${esc(venueUrl)}" style="color:#c92a2a;text-decoration:none;">${venueLabel}</a>` : venueLabel}</p>
                  </td>
                </tr>
                ${competitionRow}
              </table>
            </td>
          </tr>

          <!-- Roster heading -->
          <tr>
            <td style="padding:24px 32px 12px;">
              <p style="margin:0;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.12em;">
                Roster &mdash; ${sorted.length} player${sorted.length !== 1 ? "s" : ""}
              </p>
            </td>
          </tr>

          <!-- Roster table -->
          <tr>
            <td style="padding:0 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
                ${playerRows}
              </table>
            </td>
          </tr>

          <!-- Coach message (conditional) -->
          ${coachBlock}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 12px;">
                <a href="${esc(appUrl)}" style="font-size:13px;font-weight:700;color:#c92a2a;text-decoration:none;">
                  View schedule &amp; stats &rarr;
                </a>
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.7;">
                You received this email because you subscribed to roster notifications for Armani Katehano.<br />
                <a href="${esc(unsubscribeUrl)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

  <!--[if mso]></td></tr></table><![endif]-->

</body>
</html>`;
}

export function buildText(
  game: Game,
  players: PlayerSlot[],
  message: string | null | undefined,
  appUrl: string,
  unsubscribeUrl: string,
): string {
  const isHome     = game.location === "home";
  const matchup    = `${isHome ? "vs" : "@"} ${game.opponent}`;
  const dateStr    = formatDate(game.scheduledFor);
  const venueLabel = game.notes ?? (isHome ? "Home" : "Away");
  const venueUrl   = game.notes ? getVenueUrl(game.notes) : null;

  const rosterLines = [...players]
    .sort((a, b) => a.number - b.number)
    .map(p => {
      const num  = `#${p.number}`.padEnd(5);
      const note = p.note ? `   (${p.note})` : "";
      return `  ${num}  ${p.name}${note}`;
    })
    .join("\n");

  const coachMsg = message
    ? `\nNote from the coach\n${"─".repeat(36)}\n${sanitize(message)}\n`
    : "";

  const compLine = game.competition ? `  Competition  ${game.competition}\n` : "";

  return [
    `ARMANI KATEHANO`,
    `Roster Announcement`,
    ``,
    `${"─".repeat(36)}`,
    ``,
    `  ${matchup}`,
    ``,
    `  Date    ${dateStr}`,
    `  Venue   ${venueLabel}${venueUrl ? `\n           ${venueUrl}` : ""}`,
    compLine,
    `Roster -- ${players.length} players`,
    `${"─".repeat(36)}`,
    rosterLines,
    ``,
    coachMsg,
    `${"─".repeat(36)}`,
    ``,
    `View schedule & stats:  ${appUrl}`,
    ``,
    `${"─".repeat(36)}`,
    `You received this email because you subscribed`,
    `to roster notifications for Armani Katehano.`,
    ``,
    `Unsubscribe  ${unsubscribeUrl}`,
  ].filter(l => l !== undefined).join("\n");
}
