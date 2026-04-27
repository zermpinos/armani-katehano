/**
 * Smoke-tests the live listing parser + discovery service against real
 * basketcity.sportstats.gr HTML. No DB writes, no email -- just fetches.
 *
 * Default (no args): dumps every past row the parser finds on both the men
 * and master-winter-cup listings. Use this to confirm the scraper still
 * understands the upstream HTML.
 *
 * Targeted mode: pass --opponent and --date to also run the full
 * discoverSourceUrl matcher end-to-end.
 *
 *   npx tsx scripts/smoke-discover.ts
 *   npx tsx scripts/smoke-discover.ts --listing=men --opponent="Geroleague Stars" --date=2026-03-15
 *   npx tsx scripts/smoke-discover.ts --listing=cup --opponent="Xlatsers Legends" --date=2026-02-01
 */
import "dotenv/config";
import { parseListingHtml }   from "@/server/integrations/scraper/listing";
import { discoverSourceUrl }  from "@/server/services/discover-source-url";

const LISTINGS = {
  men: "https://basketcity.sportstats.gr/men/teamdetails/id/BED40AE7-E186-454A-AF1D-9010E46EC048",
  cup: "https://basketcity.sportstats.gr/master-winter-cup/teamdetails/id/bed40ae7-e186-454a-af1d-9010e46ec048",
} as const;

function arg(name: string): string | null {
  const m = process.argv.find(a => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
}

async function dumpListing(label: string, url: string): Promise<void> {
  console.log(`\n── ${label} ─────────────────────────────────────────────`);
  console.log(`fetching ${url}`);
  const r = await fetch(url, {
    redirect: "manual",
    headers: {
      "User-Agent":      "BoxScoreScraper/1.0",
      "Accept":          "text/html,application/xhtml+xml",
      "Accept-Language": "el-GR,el;q=0.9,en;q=0.8",
    },
  });
  if (!r.ok) { console.log(`  HTTP ${r.status}`); return; }
  const rows = parseListingHtml(await r.text(), url);
  console.log(`  parsed ${rows.length} past rows:`);
  for (const row of rows) {
    const date = row.playedOn.toISOString().slice(0, 10);
    const side = row.isHome ? "vs" : " @";
    console.log(`  ${date}  ${side} ${row.opponent.padEnd(34)}  ${row.gameUrl}`);
  }
}

async function main(): Promise<void> {
  const which    = (arg("listing") ?? "all") as "men" | "cup" | "all";
  const opponent = arg("opponent");
  const dateStr  = arg("date");

  const targets: [string, string][] =
    which === "all" ? [["men", LISTINGS.men], ["cup", LISTINGS.cup]]
                    : [[which, Reflect.get(LISTINGS, which) as string]];

  for (const [label, url] of targets) await dumpListing(label, url);

  if (opponent && dateStr) {
    const url = LISTINGS[which === "all" ? "men" : which];
    console.log(`\n── targeted match ───────────────────────────────────────`);
    console.log(`  listing: ${url}`);
    console.log(`  opponent: ${opponent}`);
    console.log(`  date:     ${dateStr}`);
    const result = await discoverSourceUrl({
      listingUrl:   url,
      scheduledFor: new Date(`${dateStr}T19:00:00Z`),
      opponent,
    });
    console.log(`  ->`, result);
  } else if (opponent || dateStr) {
    console.log(`\n  (pass both --opponent="..." and --date=YYYY-MM-DD to run the matcher)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
