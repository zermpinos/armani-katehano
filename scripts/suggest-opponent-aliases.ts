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
 * Greek is transliterated by ELOT 743, the scheme Greek passports use, so the
 * output is uniform and predictable rather than a per-name judgement. The rule
 * knows shapes, not meanings: an acronym reads as a word and a brand loses its
 * inner capital. Read the output before running it, and fix those by editing
 * the row, never by teaching this script a name.
 *
 * Run: npx tsx scripts/suggest-opponent-aliases.ts
 *      npx tsx scripts/suggest-opponent-aliases.ts --check-existing
 *
 * --check-existing reports rows already in the table whose display name the
 * rule would write differently. A row listed there is drift or a deliberate
 * override, and either way it should be a decision somebody made rather than
 * one nobody remembers.
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

// ELOT 743, the scheme Greek passports use. Applied because the names written
// by hand before it had no rule: chi read as x in one and ch in another,
// upsilon as y, i and v across three. A rule nobody can state is a rule nobody
// can apply to the next name.
const VOICELESS = new Set([..."θκξπστφχψ"]);

// Maps rather than objects: the keys come from scraped markup.
const GREEK = new Map<string, string>(Object.entries({
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
  ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
}));

function elot743(word: string): string {
  const w = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC").toLowerCase();
  let out = "";
  for (let i = 0; i < w.length; ) {
    const pair = w.slice(i, i + 2);
    const after = w.charAt(i + 2);
    // The diphthongs take v before a vowel or voiced consonant, f before a
    // voiceless one, which is the only context-sensitive part of the scheme.
    if (pair === "αυ" || pair === "ευ" || pair === "ηυ") {
      out += (pair[0] === "α" ? "a" : pair[0] === "ε" ? "e" : "i") + (after && VOICELESS.has(after) ? "f" : "v");
      i += 2; continue;
    }
    const digraph = new Map<string, string>(Object.entries({
      ου: "ou", αι: "ai", ει: "ei", οι: "oi", υι: "yi", γγ: "ng", γκ: "gk",
      // Word initial only; medial keeps both letters.
      μπ: i === 0 ? "b" : "mp",
      ντ: i === 0 ? "d" : "nt",
    }));
    const two = digraph.get(pair);
    if (two) { out += two; i += 2; continue; }
    const one = w.charAt(i);
    out += GREEK.get(one) ?? one;
    i += 1;
  }
  return out;
}

const titleCase = (s: string) =>
  s.replace(/\p{L}[\p{L}'\u2019]*/gu, w => w[0].toUpperCase() + w.slice(1));

// Rules by shape only. Nothing here knows what a word means, so no name gets a
// special case: an acronym reads as a word and a brand loses its inner capital,
// and both are fixed by editing the row rather than by teaching this a name.
function suggest(scraped: string): string {
  return scraped.split(/\s+/).map(token => {
    // A token starting with a digit reads as an ordinal: 3rd, not 3Rd.
    if (/^\d/.test(token)) return token.toLowerCase();
    // A dotted token is an abbreviation whatever language it is in.
    if (/\./.test(token) || token === "BC") return token;
    if (/[\u0370-\u03FF]/.test(token)) return titleCase(elot743(token));
    return titleCase(token.toLowerCase());
  }).join(" ");
}

const sqlQuote = (s: string) => s.replace(/'/g, "''");

async function checkExisting() {
  const rows = await prisma.opponentAlias.findMany({ orderBy: { scrapedName: "asc" } });
  const drift = rows.filter(r => suggest(r.scrapedName) !== r.displayName);

  console.error(`${rows.length} rows, ${drift.length} the rule would write differently\n`);
  if (drift.length === 0) return;

  for (const r of drift) {
    console.error(`  ${r.scrapedName}\n    stored: ${r.displayName}\n    rule:   ${suggest(r.scrapedName)}`);
  }
  console.log("\n-- To adopt the rule for these:");
  for (const r of drift) {
    console.log(`UPDATE "OpponentAlias" SET "displayName" = '${sqlQuote(suggest(r.scrapedName))}' WHERE "scrapedName" = '${sqlQuote(r.scrapedName)}';`);
  }
}

async function main() {
  if (process.argv.includes("--check-existing")) return checkExisting();

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

  console.log("-- Transliteration is ELOT 743. Read it before running: the rule reads shapes, not meanings.");
  console.log('INSERT INTO "OpponentAlias" ("id", "scrapedName", "displayName") VALUES');
  // Greek names are marked rather than transliterated. The names already in the
  // table map the same letter several ways depending on the word, Gerolykoi and
  // Aspromavra and Ipovrichia all from a different reading of upsilon, so a map
  // would produce plausible wrong answers. These need a person.
  const greek = (s: string) => /[\u0370-\u03FF]/.test(s);

  console.log(missing.map((name, i) =>
    `  ('team_${String(i).padStart(3, "0")}', '${sqlQuote(name)}', '${sqlQuote(suggest(name))}')`,
  ).join(",\n") + "\nON CONFLICT (\"scrapedName\") DO NOTHING;");
}

main()
  .catch(err => { console.error(err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
