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
  const bg    = isWin ? "#16a34a" : "#c92a2a";
  return `<span style="display:inline-block;padding:6px 14px;border-radius:999px;background:${bg};color:#fff;font-size:14px;font-weight:800;letter-spacing:0.12em;">${esc(result)}</span>`;
}

type Align = "left" | "right";

function headerCell(label: string, align: Align = "left", widthPx?: number): string {
  const alignDecl = align === "right" ? "text-align:right;" : "";
  const widthDecl = widthPx !== undefined ? `width:${widthPx}px;` : "";
  return `<td style="padding:8px 16px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;${alignDecl}${widthDecl}">${esc(label)}</td>`;
}

function statCell(value: number, emphasized = false): string {
  const color  = emphasized ? "#111827" : "#374151";
  const weight = emphasized ? "font-weight:700;" : "";
  return `<td style="padding:10px 16px;font-size:13px;color:${color};text-align:right;font-variant-numeric:tabular-nums;${weight}">${value}</td>`;
}

function performerRow(p: TopPerformer, i: number): string {
  const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
  return `
        <tr style="background:${bg};">
          <td style="padding:10px 16px;width:44px;font-size:12px;font-weight:900;color:#c92a2a;font-variant-numeric:tabular-nums;">#${p.number}</td>
          <td style="padding:10px 16px;font-size:14px;color:#111827;font-weight:600;">${esc(p.name)}</td>
          ${statCell(p.pts, true)}
          ${statCell(p.reb)}
          ${statCell(p.ast)}
        </tr>`;
}

function nonEmpty(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim() !== "";
}

function shortOpponent(opponent: string): string {
  const first = opponent.trim().split(/\s+/)[0] ?? opponent;
  return first.slice(0, 12);
}

export function buildGameImportedHtml(
  game: GameImportedGame,
  top:  TopPerformer[],
  appUrl: string,
  unsubscribeUrl: string,
): string {
  const matchup     = `${vsAt(game.location)} ${esc(game.opponent)}`;
  const dateText    = esc(formatDateFull(game.playedOn.toISOString()));
  const performers  = top.map((p, i) => performerRow(p, i)).join("");

  const metaParts: string[] = [];
  if (nonEmpty(game.competition)) metaParts.push(esc(game.competition));
  if (nonEmpty(game.venueNote))   metaParts.push(`<a href="${esc(getVenueUrl(game.venueNote))}" style="color:#6b7280;text-decoration:none;">${esc(game.venueNote)}</a>`);
  const metaStrip = metaParts.length === 0
    ? ""
    : `<p style="margin:18px 0 0;font-size:12px;color:#6b7280;text-align:center;line-height:1.5;">${metaParts.join(" &middot; ")}</p>`;

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
        <tr><td style="background:#111111;padding:32px 32px 28px;">
          <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c92a2a;">Armani Katehano &middot; Game Recap</p>
          <p style="margin:14px 0 0;font-size:30px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;line-height:1.15;">${matchup}</p>
          <p style="margin:8px 0 0;font-size:14px;font-weight:600;color:#d1d5db;">${esc(formatDateFull(game.playedOn.toISOString()))}</p>
        </td></tr>
        <!-- Score -->
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 18px;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#9ca3af;text-align:center;">Final</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left" style="width:42%;">
                <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.18em;">AK</p>
                <p style="margin:0;font-size:44px;font-weight:900;color:#111827;font-variant-numeric:tabular-nums;line-height:1;">${game.teamScore}</p>
              </td>
              <td align="center" style="width:16%;vertical-align:middle;">
                ${resultPill(game.result)}
              </td>
              <td align="right" style="width:42%;">
                <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.18em;">${esc(shortOpponent(game.opponent))}</p>
                <p style="margin:0;font-size:44px;font-weight:900;color:#111827;font-variant-numeric:tabular-nums;line-height:1;">${game.opponentScore}</p>
              </td>
            </tr>
          </table>
          ${metaStrip}
        </td></tr>
        <!-- Performers -->
        <tr><td style="padding:24px 32px 0;">
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.12em;">Top performers</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr style="background:#f3f4f6;">
              ${headerCell("#", "left", 44)}
              ${headerCell("Player")}
              ${headerCell("Pts", "right", 48)}
              ${headerCell("Reb", "right", 48)}
              ${headerCell("Ast", "right", 48)}
            </tr>
            ${performers}
          </table>
        </td></tr>
        <!-- CTA -->
        <tr><td align="center" style="padding:8px 32px 32px;">
          <a href="${esc(`${appUrl}/games/${game.id}`)}" style="display:inline-block;padding:14px 28px;background:#c92a2a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">View full box score &rarr;</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.7;">
            You received this email because you subscribed to Armani Katehano game emails.<br />
            <a href="${esc(`${appUrl}/privacy`)}" style="color:#6b7280;text-decoration:underline;">Privacy notice</a>
            &nbsp;&middot;&nbsp;
            <a href="${esc(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
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
  const matchup     = `${vsAt(game.location)} ${game.opponent}`;
  const date        = formatDateFull(game.playedOn.toISOString());
  const resultLine  = `${game.teamScore}-${game.opponentScore} (${game.result})`;
  const showComp    = nonEmpty(game.competition);
  const showVenue   = nonEmpty(game.venueNote);

  const numWidth  = 5;
  const nameWidth = Math.max(...top.map(p => p.name.length), 0) + 2;
  const performerLine = (p: TopPerformer): string => {
    const num   = `#${p.number}`.padEnd(numWidth);
    const name  = p.name.padEnd(nameWidth);
    return `  ${num} ${name}${p.pts} pts · ${p.reb} reb · ${p.ast} ast`;
  };

  const lines: string[] = [];
  lines.push("ARMANI KATEHANO · GAME RECAP");
  lines.push("");
  lines.push(`  ${matchup}`);
  lines.push(`  ${date}`);
  lines.push("");
  lines.push(`  Result       ${resultLine}`);
  if (showComp)  lines.push(`  Competition  ${game.competition}`);
  if (showVenue) lines.push(`  Venue        ${game.venueNote}`);
  lines.push("");
  lines.push(`TOP PERFORMERS · ${top.length}`);
  for (const p of top) lines.push(performerLine(p));
  lines.push("");
  lines.push(`Full box score:  ${appUrl}/games/${game.id}`);
  lines.push("");
  lines.push("You received this email because you subscribed");
  lines.push("to Armani Katehano game emails.");
  lines.push("");
  lines.push(`Privacy notice  ${appUrl}/privacy`);
  lines.push(`Unsubscribe     ${unsubscribeUrl}`);
  return lines.join("\n");
}
