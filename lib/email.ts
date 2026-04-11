/**
 * lib/email.ts
 *
 * Nodemailer + Gmail wrapper for roster announcement emails.
 *
 * Env vars required:
 *   GMAIL_USER          — the Gmail address used to send (e.g. teamak2526@gmail.com)
 *   GMAIL_APP_PASSWORD  — 16-char Google App Password (not your Gmail login password)
 *                         Generate at: myaccount.google.com → Security → App Passwords
 *   NEXT_PUBLIC_APP_URL — your Vercel URL, e.g. https://armani-katehano.vercel.app
 */

import nodemailer from "nodemailer";
import { auditLog } from "./security";

interface PlayerSlot {
  name:   string;
  number: number;
  note:   string | null;
}

interface Game {
  opponent:     string;
  scheduledFor: string; // ISO string
  location:     string;
  competition:  string | null;
}

interface Subscriber {
  email: string;
  token: string;
}

interface SendRosterAnnouncementParams {
  game:        Game;
  players:     PlayerSlot[];
  message?:    string | null;
  subscribers: Subscriber[];
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("el-GR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens",
  });
}

function sanitize(s: string): string {
  return s.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, 1000);
}

// ─── HTML email ───────────────────────────────────────────────────────────────

function buildHtml(
  game: Game,
  players: PlayerSlot[],
  message: string | null | undefined,
  appUrl: string,
  unsubscribeUrl: string,
): string {
  const isHome  = game.location === "home";
  const matchup = `${isHome ? "vs" : "@"} ${esc(game.opponent)}`;
  const venue   = isHome ? "Home" : "Away";
  const dateStr = esc(formatDate(game.scheduledFor));

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

  // Hidden preheader — shows as the grey snippet in the inbox list
  const preheader = `Roster announced · ${isHome ? "vs" : "@"} ${game.opponent} · ${formatDate(game.scheduledFor)}`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="el">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Roster Announcement — Armani Katehano</title>
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
                    <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600;">${venue}</p>
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

// ─── Plain-text fallback ──────────────────────────────────────────────────────

function buildText(
  game: Game,
  players: PlayerSlot[],
  message: string | null | undefined,
  appUrl: string,
  unsubscribeUrl: string,
): string {
  const isHome  = game.location === "home";
  const matchup = `${isHome ? "vs" : "@"} ${game.opponent}`;
  const dateStr = formatDate(game.scheduledFor);
  const venue   = isHome ? "Home" : "Away";

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
    `  Venue   ${venue}`,
    compLine,
    `Roster — ${players.length} players`,
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

// ─── Transport ────────────────────────────────────────────────────────────────

function createTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendRosterAnnouncement({
  game,
  players,
  message,
  subscribers,
}: SendRosterAnnouncementParams): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping email send");
    return;
  }
  if (subscribers.length === 0) return;

  const from    = `Armani Katehano <${process.env.GMAIL_USER}>`;
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const isHome  = game.location === "home";
  const subject = `Roster announced: ${isHome ? "vs" : "@"} ${game.opponent}`;

  let sent   = 0;
  let failed = 0;

  for (const sub of subscribers) {
    const unsubscribeUrl = `${appUrl}/unsubscribe?token=${sub.token}`;
    const html = buildHtml(game, players, message, appUrl, unsubscribeUrl);
    const text = buildText(game, players, message, appUrl, unsubscribeUrl);
    try {
      await transport.sendMail({ from, to: sub.email, subject, html, text });
      sent++;
    } catch (err) {
      failed++;
      auditLog("roster_email_failed", { email: sub.email, error: (err as any).message });
    }
  }

  auditLog("roster_emails_sent", { sent, failed, opponent: game.opponent });
}
