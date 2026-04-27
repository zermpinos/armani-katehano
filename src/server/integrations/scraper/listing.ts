/**
 * Parses sportstats team-listing pages (basketcity.sportstats.gr/<league>/teamdetails/id/<UUID>)
 * into the rows we care about: past games with a gamedetails URL.
 *
 * Upcoming/scheduled games are not exposed with a URL on this view -- we only see them
 * after the game has been published (which happens shortly before/after tip-off).
 */

import * as cheerio from "cheerio";
import { z } from "zod";
import { parseGreekDate } from "@/domain/calendar/greek-date";

export const ListingRowSchema = z.object({
  gameUrl:    z.string().url(),
  playedOn:   z.date(),
  homeTeam:   z.string().min(1),
  awayTeam:   z.string().min(1),
  opponent:   z.string().min(1),
  isHome:     z.boolean(),
});

export type ListingRow = z.infer<typeof ListingRowSchema>;

const AK_PATTERNS = [/ARMANI/i, /KATEHANO/i, /ΚΑΤΕΧΑΝΟ/i];

function isUs(name: string): boolean {
  return AK_PATTERNS.some(p => p.test(name));
}

function clean(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function parseListingHtml(html: string, listingUrl: string): ListingRow[] {
  const $        = cheerio.load(html);
  const baseOrigin = new URL(listingUrl).origin;
  const seen     = new Set<string>();
  const rows: ListingRow[] = [];

  $("li.past").each((_, li) => {
    const $li = $(li);

    const href = $li.find("a.schedule_main_content").first().attr("href")
              ?? $li.find("a[href*='/gamedetails/id/']").first().attr("href");
    if (!href) return;
    const gameUrl = href.startsWith("http") ? href : baseOrigin + href;
    if (seen.has(gameUrl)) return;

    const dateText = clean($li.find("div.date").first().text());
    const playedOn = parseGreekDate(dateText);
    if (!playedOn) return;

    const left  = clean($li.find("table.country.left  div.name").first().text());
    const right = clean($li.find("table.country.right div.name").first().text());
    if (!left || !right) return;

    const weAreLeft = isUs(left);
    const weAreRight = isUs(right);
    if (weAreLeft === weAreRight) return; // either both us or neither -- skip
    const opponent = weAreLeft ? right : left;
    const isHome   = weAreRight; // the right-hand team is the home team on this site's layout

    const candidate = {
      gameUrl,
      playedOn,
      homeTeam: isHome ? right : left,
      awayTeam: isHome ? left  : right,
      opponent,
      isHome,
    };

    const parsed = ListingRowSchema.safeParse(candidate);
    if (!parsed.success) return;

    seen.add(gameUrl);
    rows.push(parsed.data);
  });

  return rows;
}
