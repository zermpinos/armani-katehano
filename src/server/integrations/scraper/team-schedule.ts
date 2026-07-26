/**
 * Parses a sportstats team page into the games it lists.
 * Exports parseTeamSchedule(html, pageUrl) -> ListedGame[].
 */

import "@/server/_internal/node-only";
import * as cheerio from "cheerio";
import { detectLeagueSlug } from "@/domain/calendar/greek-date";

export interface ListedGame {
  gameId:     string;
  url:        string;
  leagueSlug: string | null;
  round:      "regular" | "quarterfinal" | "semifinal" | "final";
  dateText:   string;
  // The listing shows a score only once a result has been published, which is
  // the one signal that a game is over that does not come from the game page.
  hasScore:   boolean;
}

// A /men/ URL is shared by every weekday league, so the slug alone cannot say
// which. The listing labels each row, which is the only place that is written.
// Maps rather than objects: the keys come from scraped markup.
const MEN_LEAGUES = new Map<string, string>([
  ["BC6",           "bc6"],
  ["BC8",           "bc8"],
  ["ROOKIE LEAGUE", "rookie"],
]);

// Anything unlisted is regular, including "1ος Γύρος" and the cup's "Θέσεις 1-8".
const ROUNDS = new Map<string, ListedGame["round"]>([
  ["PLAY OFFS",      "quarterfinal"],
  ["ΗΜΙΤΕΛΙΚΗ ΦΑΣΗ", "semifinal"],
  ["ΤΕΛΙΚΟΣ",        "final"],
  ["ΤΕΛΙΚΗ ΦΑΣΗ",    "final"],
]);

// Greek uppercasing keeps its accents, so labels are compared without them.
function labelKey(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim().toUpperCase();
}

export function parseTeamSchedule(html: string, pageUrl: string): ListedGame[] {
  const $ = cheerio.load(html);
  const origin = new URL(pageUrl).origin;
  const byId = new Map<string, ListedGame>();

  $(".schedule_list li").each((_, el) => {
    const $el  = $(el);
    const href = $el.find("a.schedule_main_content").attr("href");
    if (!href) return;

    const gameId = href.split("/id/")[1]?.trim();
    if (!gameId) return;

    const url   = new URL(href, origin).toString();
    const parts = ($el.find(".title").html() ?? "")
      .split(/<br\s*\/?>/i)
      .map(p => labelKey(p.replace(/<[^>]*>/g, "")))
      .filter(Boolean);

    const urlSlug    = detectLeagueSlug(url);
    const leagueSlug = urlSlug === "men"
      ? parts.map(p => MEN_LEAGUES.get(p)).find(Boolean) ?? null
      : urlSlug;

    const round    = parts.map(p => ROUNDS.get(p)).find(Boolean) ?? "regular";
    const dateText = $el.find(".date").first().text().split("/")[0].trim();
    const hasScore = $el.find(".points .number").length > 0;

    // The same game appears in both the results list and the fixture list, once
    // with a score and once without. Either sighting of a score counts.
    const seen = byId.get(gameId);
    if (seen) {
      seen.hasScore ||= hasScore;
      if (!seen.dateText) seen.dateText = dateText;
      return;
    }
    byId.set(gameId, { gameId, url, leagueSlug, round, dateText, hasScore });
  });

  return [...byId.values()];
}
