import "@/server/_internal/node-only";
import { esc, formatDateFull } from "./shared";
import { getVenueUrl } from "@/domain/shared/venues";

export interface GameImportedGame {
  id:            string;
  opponent:      string;
  location:      string | null;
  teamScore:     number;
  opponentScore: number;
  result:        string;
  playedOn:      Date;
  venueNote:     string | null;
  competition:   string | null;
}

export interface TopPerformer {
  number: number;
  name:   string;
  pts:    number;
  reb:    number;
  ast:    number;
}

function vsAt(location: string | null): string {
  return location === "home" ? "vs" : "@";
}

function resultPill(result: string): string {
  const isWin = result === "W";
  const bg    = isWin ? "#16a34a" : "#dc2626";
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${bg};color:#fff;font-size:11px;font-weight:800;letter-spacing:0.08em;">${esc(result)}</span>`;
}

function performerRow(p: TopPerformer, i: number): string {
  const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
  return `
        <tr style="background:${bg};">
          <td style="padding:10px 16px;width:44px;font-size:12px;font-weight:900;color:#c92a2a;font-variant-numeric:tabular-nums;">#${p.number}</td>
          <td style="padding:10px 16px;font-size:14px;color:#111827;font-weight:600;">${esc(p.name)}</td>
          <td style="padding:10px 16px;font-size:12px;color:#374151;text-align:right;font-variant-numeric:tabular-nums;">${p.pts} pts &middot; ${p.reb} reb &middot; ${p.ast} ast</td>
        </tr>`;
}

function infoRow(label: string, valueHtml: string): string {
  return `
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #f3f4f6;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">${esc(label)}</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600;">${valueHtml}</p>
                  </td>
                </tr>`;
}

function nonEmpty(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim() !== "";
}

export function buildGameImportedHtml(
  game: GameImportedGame,
  top:  TopPerformer[],
  appUrl: string,
  unsubscribeUrl: string,
): string {
  const matchup     = `${vsAt(game.location)} ${esc(game.opponent)}`;
  const dateText    = esc(formatDateFull(game.playedOn.toISOString()));
  const venueLine   = game.venueNote ? `<p style="margin:6px 0 0;font-size:12px;color:#6b7280;">${esc(game.venueNote)}</p>` : "";
  const performers  = top.map((p, i) => performerRow(p, i)).join("");

  const resultValue       = `${game.teamScore}-${game.opponentScore} ${resultPill(game.result)}`;
  const competitionRowStr = nonEmpty(game.competition) ? infoRow("Competition", esc(game.competition)) : "";
  const venueRowStr       = nonEmpty(game.venueNote)
    ? infoRow("Venue", `<a href="${esc(getVenueUrl(game.venueNote))}" style="color:#c92a2a;text-decoration:none;">${esc(game.venueNote)}</a>`)
    : "";
  const infoBlock = `
        <!-- Info -->
        <tr><td style="padding:20px 32px 4px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${infoRow("Result", resultValue)}
            ${competitionRowStr}
            ${venueRowStr}
          </table>
        </td></tr>`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${matchup} ${game.teamScore}-${game.opponentScore} (${esc(game.result)})</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;-webkit-font-smoothing:antialiased;">
  <!--[if mso]><table width="100%"><tr><td><![endif]-->

  <!-- Preheader -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Final &middot; ${esc(formatDateFull(game.playedOn.toISOString()))} &middot; ${game.teamScore}-${game.opponentScore} (${esc(game.result)})</span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#111111;padding:28px 32px;">
          <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c92a2a;">Armani Katehano &middot; Game Recap</p>
          <p style="margin:10px 0 0;font-size:22px;font-weight:900;color:#ffffff;">${matchup}</p>
          ${venueLine}
        </td></tr>
${infoBlock}
        <!-- Score -->
        <tr><td style="padding:28px 32px 0;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.12em;">Final &middot; ${dateText}</p>
          <p style="margin:0;font-size:36px;font-weight:900;color:#111827;font-variant-numeric:tabular-nums;">
            ${game.teamScore}<span style="color:#9ca3af;">&ndash;</span>${game.opponentScore} ${resultPill(game.result)}
          </p>
        </td></tr>
        <!-- Performers -->
        <tr><td style="padding:24px 32px 0;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.12em;">Top performers</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">${performers}</table>
        </td></tr>
        <!-- CTA -->
        <tr><td style="padding:28px 32px;">
          <a href="${esc(`${appUrl}/games/${game.id}`)}" style="display:inline-block;padding:12px 28px;background:#c92a2a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">View full box score &rarr;</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:0 32px 24px;border-top:1px solid #e5e7eb;">
          <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;line-height:1.6;">
            You're receiving this because you subscribed to Armani Katehano game emails.<br />
            <a href="${esc(unsubscribeUrl)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>

  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;
}

export function buildGameImportedText(
  game: GameImportedGame,
  top:  TopPerformer[],
  appUrl: string,
  unsubscribeUrl: string,
): string {
  const matchup = `${vsAt(game.location)} ${game.opponent}`;
  const date    = formatDateFull(game.playedOn.toISOString());
  const lines = [
    "ARMANI KATEHANO",
    matchup,
    `Final ${date}: ${game.teamScore}-${game.opponentScore} (${game.result})`,
    "",
    "Top performers:",
    ...top.map(p => `  #${p.number} ${p.name}: ${p.pts} pts · ${p.reb} reb · ${p.ast} ast`),
    "",
    `Full box score: ${appUrl}/games/${game.id}`,
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
  ];
  return lines.join("\n");
}
