/**
 * scripts/suggest-opponent-aliases.ts
 *
 * Lists every team in the competitions we are polling and prints INSERT
 * statements for the ones OpponentAlias does not cover yet.
 *
 * The point is to do the naming once, in bulk, at the start of a season rather
 * than one interrupted import at a time. A team already in the table when its
 * first fixture appears never blocks anything.
 *
 * Suggestions are a starting point and are wrong often enough to matter: no
 * rule gets from TAZ BOYS to Taz Boyz, and Greek names need a person. Review
 * the output before running it.
 *
 * Run: npx tsx scripts/suggest-opponent-aliases.ts
 */

import prisma from "@/server/db/client";
import { fetchGuarded } from "@/server/services/scrape-game";
import { aliasKey } from "@/domain/import/opponents";
import { isUsTeam } from "@/domain/import/identity";
import * as cheerio from "cheerio";

// The listing we already poll is one team's page in a competition; the
// competition's own team index sits at /teams on the same path.
function teamsIndexUrl(listingUrl: string): string | null {
  const match = listingUrl.match(/^(https?:\/\/[^/]+\/[^/]+)\/teamdetails\//);
  return match ? `${match[1]}/teams` : null;
}

function parseTeamNames(html: string): string[] {
  const $ = cheerio.load(html);
  const names = new Set<string>();
  $("a[href*='teamdetails/id/']").each((_, el) => {
    const name = $(el).text().trim();
    if (name) names.add(name);
  });
  return [...names];
}

// Title case over the source's caps. Right for ATALANTOI HAWKS, wrong for
// TAZ BOYS, and no help at all for Greek, which is why this is reviewed.
function suggest(scraped: string): string {
  return scraped.split(/\s+/).map(token => {
    // A token starting with a digit reads as an ordinal: 3rd, not 3Rd.
    if (/^\d/.test(token)) return token.toLowerCase();
    // Everything arrives in caps, so length cannot tell an abbreviation from a
    // word: WILD, WEST and KIDS are as short as BC. Only a dotted token is
    // unambiguous, plus BC, which this league writes on half its team names.
    if (/\./.test(token) || token === "BC") return token;
    return token.toLowerCase().replace(/\p{L}[\p{L}'’]*/gu, w => w[0].toUpperCase() + w.slice(1));
  }).join(" ");
}

const sqlQuote = (s: string) => s.replace(/'/g, "''");

async function main() {
  const leagues = await prisma.league.findMany({
    where:  { listingUrl: { not: null }, seasonLeagues: { some: { season: { archivedAt: null } } } },
    select: { name: true, listingUrl: true },
  });

  if (leagues.length === 0) {
    console.error("No open league has a listing URL. Nothing to scrape.");
    process.exitCode = 1;
    return;
  }

  const scraped = new Map<string, string>();
  for (const url of new Set(leagues.map(l => teamsIndexUrl(l.listingUrl as string)).filter(Boolean) as string[])) {
    try {
      for (const name of parseTeamNames(await fetchGuarded(url))) scraped.set(aliasKey(name), name);
      console.error(`read ${url}`);
    } catch (err) {
      console.error(`FAILED ${url}: ${(err as Error).message}`);
    }
  }

  const known   = new Set((await prisma.opponentAlias.findMany()).map(a => aliasKey(a.scrapedName)));
  // Our own team appears on every index it plays in and is never an opponent.
  const missing = [...scraped.entries()]
    .filter(([key, name]) => !known.has(key) && !isUsTeam(name))
    .map(([, name]) => name).sort();

  console.error(`\n${scraped.size} teams listed, ${known.size} already named, ${missing.length} to review\n`);
  if (missing.length === 0) return;

  console.log("-- Review every displayName before running this. Greek names need a person.");
  console.log('INSERT INTO "OpponentAlias" ("id", "scrapedName", "displayName") VALUES');
  // Greek names are marked rather than transliterated. The names already in the
  // table map the same letter several ways depending on the word, Gerolykoi and
  // Aspromavra and Ipovrichia all from a different reading of upsilon, so a map
  // would produce plausible wrong answers. These need a person.
  const greek = (s: string) => /[\u0370-\u03FF]/.test(s);

  console.log(missing.map((name, i) =>
    `  ('team_${String(i).padStart(3, "0")}', '${sqlQuote(name)}', '${sqlQuote(suggest(name))}')`
    + (greek(name) ? "," : ",")
    + (greek(name) ? "  -- TRANSLITERATE" : ""),
  ).join("\n").replace(/,(\s*--[^\n]*)?$/, "$1") + "\nON CONFLICT (\"scrapedName\") DO NOTHING;");
}

main()
  .catch(err => { console.error(err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
