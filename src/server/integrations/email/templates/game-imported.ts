import "@/server/_internal/node-only";
import { esc, formatDateFull } from "./shared";
import { getVenueUrl } from "@/domain/shared/venues";
import { buildGoogleCalendarUrl } from "@/domain/shared/calendar";

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
  number:   number;
  name:     string;
  position: string;
  photoUrl: string | null;
  pts:      number;
  reb:      number;
  ast:      number;
}

export interface TeamGameStats {
  fgPct:   number | null;
  teamReb: number;
  teamTov: number;
}

export interface SeasonRecord {
  wins:   number;
  losses: number;
}

export interface NextGameInfo {
  opponent:     string;
  scheduledFor: Date;
  location:     string;
  venue:        string | null;
}

export interface GameEmailContext {
  teamStats: TeamGameStats | null;
  record:    SeasonRecord   | null;
  nextGame:  NextGameInfo   | null;
}

function vsAt(location: string | null): string {
  return location === "home" ? "vs" : "@";
}

function resultPill(result: string): string {
  const isWin = result === "W";
  const bg    = isWin ? "#16a34a" : "#c92a2a";
  return `<span style="display:inline-block;padding:6px 14px;border-radius:999px;background:${bg};color:#fff;font-size:14px;font-weight:800;letter-spacing:0.12em;">${esc(result)}</span>`;
}


function nonEmpty(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim() !== "";
}

function shortOpponent(opponent: string): string {
  const first = opponent.trim().split(/\s+/)[0] ?? opponent;
  return first.slice(0, 12);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = (parts[0]?.[0] ?? "").toUpperCase();
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "").toUpperCase() : "";
  return esc(a + b);
}

function statColor(value: number, max: number): string {
  return value === max && max > 0 ? "#c92a2a" : "#374151";
}

function performerRowNew(
  p: TopPerformer,
  i: number,
  ptsMax: number,
  rebMax: number,
  astMax: number,
): string {
  const bg  = i % 2 === 0 ? "#ffffff" : "#f9fafb";
  const avatarInner = p.photoUrl
    ? `<img src="${esc(p.photoUrl)}" width="36" height="36" border="0"
               style="display:block;width:36px;height:36px;border-radius:50%;object-fit:cover;" alt="${esc(p.name)}" />`
    : `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td width="36" height="36" bgcolor="#111111" style="background-color:#111111;border-radius:50%;text-align:center;vertical-align:middle;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;width:36px;height:36px;">${initials(p.name)}</td></tr></table>`;
  return `
        <tr style="background:${bg};">
          <td style="padding:10px 12px;width:44px;vertical-align:middle;">
            ${avatarInner}
          </td>
          <td style="padding:10px 12px;vertical-align:middle;">
            <p style="margin:0;font-size:14px;color:#111827;font-weight:600;">${esc(p.name)}</p>
          </td>
          <td style="padding:10px 12px;vertical-align:middle;font-size:12px;color:#6b7280;">${esc(p.position.trim())}</td>
          <td style="padding:10px 12px;font-size:13px;color:${statColor(p.pts, ptsMax)};text-align:right;font-variant-numeric:tabular-nums;font-weight:700;">${p.pts}</td>
          <td style="padding:10px 12px;font-size:13px;color:${statColor(p.reb, rebMax)};text-align:right;font-variant-numeric:tabular-nums;font-weight:700;">${p.reb}</td>
          <td style="padding:10px 12px;font-size:13px;color:${statColor(p.ast, astMax)};text-align:right;font-variant-numeric:tabular-nums;font-weight:700;">${p.ast}</td>
        </tr>`;
}

function statsStripHtml(stats: TeamGameStats): string {
  const fgPctDisplay = stats.fgPct !== null ? `${stats.fgPct}%` : "--";
  return `
        <tr>
          <td style="background-color:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="width:33%;padding:0 8px;">
                  <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;">Field Goal %</p>
                  <p style="margin:0;font-size:22px;font-weight:900;color:#111827;font-variant-numeric:tabular-nums;">${fgPctDisplay}</p>
                </td>
                <td align="center" style="width:33%;padding:0 8px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
                  <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;">Rebounds</p>
                  <p style="margin:0;font-size:22px;font-weight:900;color:#111827;font-variant-numeric:tabular-nums;">${stats.teamReb}</p>
                </td>
                <td align="center" style="width:33%;padding:0 8px;">
                  <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;">Turnovers</p>
                  <p style="margin:0;font-size:22px;font-weight:900;color:#c92a2a;font-variant-numeric:tabular-nums;">${stats.teamTov}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

function footerBarHtml(ctx: GameEmailContext, appUrl: string, competition: string | null): string {
  if (!ctx.record && !ctx.nextGame) return "";

  let recordHtml = "";
  if (ctx.record) {
    const { wins, losses } = ctx.record;
    const total = wins + losses;
    const winRate = total > 0
      ? `<p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">${((wins / total) * 100).toFixed(1)}% win rate</p>`
      : "";
    const recordLabel = nonEmpty(competition)
      ? `Current Record in ${esc(competition)}`
      : "Current Record";
    recordHtml = `
              <td style="vertical-align:top;padding-right:16px;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;">${recordLabel}</p>
                <p style="margin:4px 0 0;font-size:18px;font-weight:900;color:#ffffff;font-variant-numeric:tabular-nums;">${wins}&#8211;${losses}</p>
                ${winRate}
              </td>`;
  }

  let nextHtml = "";
  if (ctx.nextGame) {
    const ng = ctx.nextGame;
    const homeAway = ng.location === "home" ? "Home" : "Away";
    const googleUrl = esc(buildGoogleCalendarUrl(ng.opponent, ng.scheduledFor.toISOString(), ng.venue ?? undefined));
    const icsUrl = esc(
      `${appUrl}/api/calendar/ics?opponent=${encodeURIComponent(ng.opponent)}&date=${encodeURIComponent(ng.scheduledFor.toISOString())}&location=${encodeURIComponent(ng.location)}${ng.venue ? `&venue=${encodeURIComponent(ng.venue)}` : ""}`
    );
    nextHtml = `
              <td align="right" style="vertical-align:top;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;">Next Game</p>
                <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#ffffff;">vs ${esc(ng.opponent)} &middot; ${esc(homeAway)}</p>
                <p style="margin:8px 0 0;">
                  <a href="${googleUrl}" style="display:inline-block;padding:4px 10px;font-size:11px;font-weight:700;color:#ffffff;border:1px solid #6b7280;border-radius:6px;text-decoration:none;">Google Calendar</a>
                  &nbsp;
                  <a href="${icsUrl}" style="display:inline-block;padding:4px 10px;font-size:11px;font-weight:700;color:#ffffff;border:1px solid #6b7280;border-radius:6px;text-decoration:none;">.ics</a>
                </p>
              </td>`;
  }

  return `
        <tr>
          <td bgcolor="#111111" style="background-color:#111111;padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                ${recordHtml}
                ${nextHtml}
              </tr>
            </table>
          </td>
        </tr>`;
}

export function buildGameImportedHtml(
  game:           GameImportedGame,
  top:            TopPerformer[],
  ctx:            GameEmailContext,
  appUrl:         string,
  unsubscribeUrl: string,
): string {
  const isWin         = game.result === "W";
  const akScoreColor  = isWin ? "#ffffff" : "#4b5563";
  const oppScoreColor = isWin ? "#4b5563" : "#ffffff";
  const isHome        = game.location === "home";
  const leftLbl       = isHome ? shortOpponent(game.opponent) : "AK";
  const leftScore     = isHome ? game.opponentScore : game.teamScore;
  const leftColor     = isHome ? oppScoreColor : akScoreColor;
  const rightLbl      = isHome ? "AK" : shortOpponent(game.opponent);
  const rightScore    = isHome ? game.teamScore : game.opponentScore;
  const rightColor    = isHome ? akScoreColor : oppScoreColor;
  const matchupFull   = `${vsAt(game.location)} ${esc(game.opponent)}`;
  const dateText      = esc(formatDateFull(game.playedOn.toISOString()));

  const ptsMax = top.length > 0 ? Math.max(...top.map(p => p.pts)) : 0;
  const rebMax = top.length > 0 ? Math.max(...top.map(p => p.reb)) : 0;
  const astMax = top.length > 0 ? Math.max(...top.map(p => p.ast)) : 0;

  const performers = top.map((p, i) => performerRowNew(p, i, ptsMax, rebMax, astMax)).join("");

  const metaParts: string[] = [];
  if (nonEmpty(game.competition)) metaParts.push(esc(game.competition));
  if (nonEmpty(game.venueNote))   metaParts.push(`<a href="${esc(getVenueUrl(game.venueNote))}" style="color:#6b7280;text-decoration:none;">${esc(game.venueNote)}</a>`);
  const metaStrip = metaParts.length === 0
    ? ""
    : `<p style="margin:18px 0 0;font-size:12px;color:#6b7280;text-align:center;line-height:1.5;">${metaParts.join(" &middot; ")}</p>`;

  const competitionLine = nonEmpty(game.competition)
    ? `<p style="margin:4px 0 0;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#c92a2a;">${esc(game.competition)}</p>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${vsAt(game.location)} ${esc(game.opponent)} ${game.teamScore}-${game.opponentScore} (${esc(game.result)})</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;-webkit-font-smoothing:antialiased;">
  <!--[if mso]><table width="100%"><tr><td><![endif]-->

  <!-- Preheader -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Final &middot; ${dateText} &middot; ${game.teamScore}-${game.opponentScore} (${esc(game.result)})</span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- ① Header -->
        <tr>
          <td bgcolor="#111111" style="background-color:#111111;padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;width:60px;">
                  <img src="${esc(appUrl)}/logohighres.png" width="52" height="52" border="0"
                       style="display:block;width:52px;height:52px;" alt="Armani Katehano" />
                </td>
                <td style="padding-left:16px;vertical-align:middle;">
                  <p style="margin:0;font-size:15px;font-weight:900;color:#ffffff;">Armani Katehano</p>
                  ${competitionLine}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Red separator -->
        <tr><td bgcolor="#c92a2a" style="background-color:#c92a2a;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- ② Sub-header -->
        <tr>
          <td bgcolor="#1c1c1c" style="background-color:#1c1c1c;padding:10px 32px;">
            <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#9ca3af;">Game Recap &middot; ${dateText} &middot; ${matchupFull}</p>
          </td>
        </tr>

        <!-- ③ Score -->
        <tr>
          <td bgcolor="#1a1a1a" style="background-color:#1a1a1a;padding:28px 32px 24px;">
            <p style="margin:0 0 16px;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#9ca3af;text-align:center;">Final</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" style="width:42%;vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.18em;">${esc(leftLbl)}</p>
                  <p style="margin:0;font-size:44px;font-weight:900;color:${leftColor};font-variant-numeric:tabular-nums;line-height:1;">${leftScore}</p>
                </td>
                <td align="center" style="width:16%;vertical-align:middle;">
                  ${resultPill(game.result)}
                </td>
                <td align="right" style="width:42%;vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.18em;text-align:right;">${esc(rightLbl)}</p>
                  <p style="margin:0;font-size:44px;font-weight:900;color:${rightColor};font-variant-numeric:tabular-nums;line-height:1;text-align:right;">${rightScore}</p>
                </td>
              </tr>
            </table>
            ${metaStrip}
          </td>
        </tr>

        ${ctx.teamStats ? statsStripHtml(ctx.teamStats) : ""}

        <!-- ⑤ Top performers -->
        <tr><td style="padding:24px 32px 0;">
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.12em;">Top performers</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr style="background:#f3f4f6;">
              <td style="padding:8px 12px;width:44px;"></td>
              <td style="padding:8px 12px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Player</td>
              <td style="padding:8px 12px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Pos</td>
              <td style="padding:8px 12px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;text-align:right;">Pts</td>
              <td style="padding:8px 12px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;text-align:right;">Reb</td>
              <td style="padding:8px 12px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;text-align:right;">Ast</td>
            </tr>
            ${performers}
          </table>
        </td></tr>

        <!-- ⑥ CTA -->
        <tr><td align="center" style="padding:8px 32px 32px;">
          <a href="${esc(`${appUrl}/games/${game.id}`)}"
             style="display:inline-block;padding:14px 28px;background:#c92a2a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">View full box score &rarr;</a>
        </td></tr>

        ${footerBarHtml(ctx, appUrl, game.competition)}

        <!-- ⑧ Legal footer -->
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
  game:           GameImportedGame,
  top:            TopPerformer[],
  ctx:            GameEmailContext,
  appUrl:         string,
  unsubscribeUrl: string,
): string {
  const matchup     = `${vsAt(game.location)} ${game.opponent}`;
  const date        = formatDateFull(game.playedOn.toISOString());
  const opponentLbl = shortOpponent(game.opponent);
  const colW        = Math.max(opponentLbl.length, "AK".length);
  const oppCol      = opponentLbl.padEnd(colW);
  const akCol       = "AK".padEnd(colW);

  const metaParts: string[] = [];
  if (nonEmpty(game.competition)) metaParts.push(game.competition);
  if (nonEmpty(game.venueNote))   metaParts.push(game.venueNote);

  const numWidth  = 5;
  const nameWidth = Math.max(...top.map(p => p.name.length), "Player".length) + 2;
  const posWidth  = Math.max(...top.map(p => p.position.length), "Pos".length) + 2;

  const performerLine = (p: TopPerformer): string =>
    `  ${`#${p.number}`.padEnd(numWidth)} ${p.name.padEnd(nameWidth)}${p.position.padEnd(posWidth)}${String(p.pts).padStart(3)}  ${String(p.reb).padStart(3)}  ${String(p.ast).padStart(3)}`;

  const lines: string[] = [];
  lines.push("ARMANI KATEHANO · GAME RECAP");
  lines.push("");
  lines.push(`  ${matchup}`);
  lines.push(`  ${date}`);
  lines.push("");
  lines.push("  FINAL");
  const isHomeText  = game.location === "home";
  const leftColTxt  = isHomeText ? oppCol : akCol;
  const rightColTxt = isHomeText ? akCol  : oppCol;
  const leftScoreTxt  = isHomeText ? game.opponentScore : game.teamScore;
  const rightScoreTxt = isHomeText ? game.teamScore     : game.opponentScore;
  lines.push(`  ${leftColTxt}  ${rightColTxt}`);
  lines.push(`  ${String(leftScoreTxt).padEnd(colW)}  ${String(rightScoreTxt).padEnd(colW)}  (${game.result})`);
  if (metaParts.length > 0) {
    lines.push("");
    lines.push(`  ${metaParts.join(" · ")}`);
  }

  if (ctx.teamStats) {
    const { fgPct, teamReb, teamTov } = ctx.teamStats;
    const fgStr = fgPct !== null ? `${fgPct}%` : "N/A";
    lines.push("");
    lines.push("TEAM STATS");
    lines.push(`  FG%: ${fgStr}  REB: ${teamReb}  TOV: ${teamTov}`);
  }

  lines.push("");
  lines.push(`TOP PERFORMERS · ${top.length}`);
  lines.push(`  ${"#".padEnd(numWidth)} ${"Player".padEnd(nameWidth)}${"Pos".padEnd(posWidth)}Pts  Reb  Ast`);
  for (const p of top) lines.push(performerLine(p));

  if (ctx.record || ctx.nextGame) {
    lines.push("");
    if (ctx.record) {
      const { wins, losses } = ctx.record;
      const total = wins + losses;
      const rate  = total > 0 ? ` (${((wins / total) * 100).toFixed(1)}% win rate)` : "";
      const leagueSuffix = nonEmpty(game.competition) ? ` in ${game.competition}` : "";
      lines.push(`Current Record${leagueSuffix}:  ${wins}-${losses}${rate}`);
    }
    if (ctx.nextGame) {
      const ng      = ctx.nextGame;
      const homeAway = ng.location === "home" ? "Home" : "Away";
      lines.push(`Next:    vs ${ng.opponent} · ${homeAway}`);
      lines.push(`  + Google Calendar: ${buildGoogleCalendarUrl(ng.opponent, ng.scheduledFor.toISOString(), ng.venue ?? undefined)}`);
    }
  }

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
