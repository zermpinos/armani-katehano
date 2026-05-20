import "@/server/_internal/node-only";
import { getVenueUrl } from "@/domain/shared/venues";
import { esc, formatDateFull, formatDayTime, sanitize, type Game, type PlayerSlot } from "./shared";

function isStarter(note: string | null | undefined): boolean {
  if (!note) return false;
  return /^start(er|ing)?$/i.test(note.trim());
}

function renderPlayerRow(p: PlayerSlot, i: number): string {
  const bg        = i % 2 === 0 ? "#ffffff" : "#f9fafb";
  const showBadge = !!p.note && !isStarter(p.note);
  const note      = showBadge
    ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;letter-spacing:0.06em;">${esc(p.note!)}</span>`
    : "";
  return `
      <tr style="background:${bg};">
        <td style="padding:10px 16px;width:44px;font-size:12px;font-weight:900;color:#c92a2a;font-variant-numeric:tabular-nums;">#${p.number}</td>
        <td style="padding:10px 16px;font-size:14px;color:#111827;font-weight:600;">${esc(p.name)}${note}</td>
      </tr>`;
}

export function buildHtml(
  game: Game,
  players: PlayerSlot[],
  message: string | null | undefined,
  appUrl: string,
  unsubscribeUrl: string,
): string {
  const isHome     = game.location === "home";
  const matchup    = `${isHome ? "vs" : "@"} ${esc(game.opponent)}`;
  const venueLabel = game.notes ? esc(game.notes) : null;
  const venueUrl   = game.notes ? getVenueUrl(game.notes) : null;
  const fullDate   = esc(formatDateFull(game.scheduledFor));
  const dayTime    = esc(formatDayTime(game.scheduledFor));

  const sorted   = [...players].sort((a, b) => a.number - b.number);
  const starters = sorted.filter(p => isStarter(p.note));
  const bench    = sorted.filter(p => !isStarter(p.note));

  const tableHtml = (group: PlayerSlot[]): string => `
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
                ${group.map((p, i) => renderPlayerRow(p, i)).join("")}
              </table>`;

  const labeledTable = (label: string, group: PlayerSlot[]): string => `
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.12em;">
                ${label} &middot; ${group.length}
              </p>
              ${tableHtml(group)}`;

  const rosterBlock = (starters.length > 0 && bench.length > 0)
    ? `${labeledTable("Starters", starters)}
              <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
              ${labeledTable("Bench", bench)}`
    : tableHtml(starters.length > 0 ? starters : bench);

  const locationText = isHome ? "Home" : "Away";
  const venueSuffix  = venueLabel
    ? ` &middot; ${venueUrl ? `<a href="${esc(venueUrl)}" style="color:#c92a2a;text-decoration:none;">${venueLabel}</a>` : venueLabel}`
    : "";

  const coachBlock = message ? `
    <tr>
      <td style="padding:0 32px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.12em;">Message from the coach</p>
              <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.7;">${esc(sanitize(message))}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : "";

  const competitionRow = game.competition ? `
    <tr>
      <td style="padding:8px 0;border-top:1px solid #f3f4f6;">
        <p style="margin:0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Competition</p>
        <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600;">${esc(game.competition)}</p>
      </td>
    </tr>` : "";

  const preheader = `${players.length} players · ${formatDayTime(game.scheduledFor)}${game.notes ? ` · ${game.notes}` : ""}`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
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

          <!-- Header — matchup is the hero -->
          <tr>
            <td style="background:#111111;padding:32px 32px 28px;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c92a2a;">Armani Katehano &middot; Game Day Roster</p>
              <p style="margin:14px 0 0;font-size:30px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;line-height:1.15;">${matchup}</p>
              <p style="margin:8px 0 0;font-size:14px;font-weight:600;color:#d1d5db;">${dayTime}</p>
            </td>
          </tr>

          <!-- Match info -->
          <tr>
            <td style="padding:24px 32px 20px;border-bottom:1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #f3f4f6;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Date</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600;">${fullDate}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #f3f4f6;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Location</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600;">${locationText}${venueSuffix}</p>
                  </td>
                </tr>
                ${competitionRow}
              </table>
            </td>
          </tr>

          <!-- Roster -->
          <tr>
            <td style="padding:24px 32px 8px;">${rosterBlock}
            </td>
          </tr>

          <!-- Coach message (conditional) -->
          ${coachBlock}

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:8px 32px 32px;">
              <a href="${esc(appUrl)}" style="display:inline-block;padding:14px 28px;background:#c92a2a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">
                View full schedule
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.7;">
                You received this email because you subscribed to Armani Katehano game emails.<br />
                <a href="${esc(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
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
  const isHome   = game.location === "home";
  const matchup  = `${isHome ? "vs" : "@"} ${game.opponent}`;
  const fullDate = formatDateFull(game.scheduledFor);
  const dayTime  = formatDayTime(game.scheduledFor);
  const venueUrl = game.notes ? getVenueUrl(game.notes) : null;
  const locationLn = `${isHome ? "Home" : "Away"}${game.notes ? ` · ${game.notes}` : ""}`;

  const fmtLine = (p: PlayerSlot): string => {
    const num  = `#${p.number}`.padEnd(5);
    const note = p.note && !isStarter(p.note) ? `   (${p.note})` : "";
    return `  ${num}  ${p.name}${note}`;
  };

  const sortedPlayers = [...players].sort((a, b) => a.number - b.number);
  const startersTxt   = sortedPlayers.filter(p => isStarter(p.note)).map(fmtLine);
  const benchTxt      = sortedPlayers.filter(p => !isStarter(p.note)).map(fmtLine);

  const lines: string[] = [];
  lines.push(`ARMANI KATEHANO · GAME DAY ROSTER`);
  lines.push(``);
  lines.push(`  ${matchup}`);
  lines.push(`  ${dayTime}`);
  lines.push(``);
  lines.push(`  Date         ${fullDate}`);
  lines.push(`  Location     ${locationLn}`);
  if (venueUrl) lines.push(`               ${venueUrl}`);
  if (game.competition) lines.push(`  Competition  ${game.competition}`);
  lines.push(``);

  if (startersTxt.length > 0 && benchTxt.length > 0) {
    lines.push(`STARTERS · ${startersTxt.length}`);
    lines.push(...startersTxt);
    lines.push(``);
    lines.push(`  ${"·".repeat(32)}`);
    lines.push(``);
    lines.push(`BENCH · ${benchTxt.length}`);
    lines.push(...benchTxt);
  } else if (startersTxt.length > 0) {
    lines.push(`STARTERS · ${startersTxt.length}`);
    lines.push(...startersTxt);
  } else {
    lines.push(`ROSTER · ${benchTxt.length}`);
    lines.push(...benchTxt);
  }
  lines.push(``);

  if (message) {
    lines.push(`Message from the coach`);
    lines.push(`${"─".repeat(36)}`);
    lines.push(sanitize(message));
    lines.push(``);
  }

  lines.push(`View full schedule:  ${appUrl}`);
  lines.push(``);
  lines.push(`You received this email because you subscribed`);
  lines.push(`to Armani Katehano game emails.`);
  lines.push(``);
  lines.push(`Unsubscribe  ${unsubscribeUrl}`);

  return lines.join("\n");
}
