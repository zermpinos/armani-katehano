import "@/server/_internal/node-only";
import prisma from "@/server/db/client";
import { fetchGuarded } from "@/server/services/scrape-game";
import { parseTeamSchedule, type ListedGame } from "@/server/integrations/scraper/team-schedule";

export interface Discovery {
  games:  ListedGame[];
  errors: string[];
}

// Games the organisers have published a result for, newest first. A page that
// fails to load is reported rather than thrown: one league being down should
// not stop the other from importing.
export async function discoverGames(): Promise<Discovery> {
  const byId  = new Map<string, ListedGame>();
  const errors: string[] = [];

  // Listing URLs live on the league rather than in the environment, so a league
  // that starts mid-season does not need a redeploy to be polled. An archived
  // season is closed, so its leagues are not worth a fetch.
  const leagues = await prisma.league.findMany({
    where:   { listingUrl: { not: null }, seasonLeagues: { some: { season: { archivedAt: null } } } },
    select:  { name: true, organization: true, listingUrl: true },
    orderBy: { slug: "asc" },
  });

  if (leagues.length === 0) errors.push("No active league has a listing URL configured");

  for (const league of leagues) {
    // Only the sportstats listing has a parser today. Reporting the skip keeps a
    // misconfigured league from looking like a quiet week.
    if (league.organization !== "basketcity") {
      errors.push(`${league.name}: no listing parser for ${league.organization}`);
      continue;
    }

    const url = league.listingUrl as string;
    try {
      for (const g of parseTeamSchedule(await fetchGuarded(url), url)) {
        if (!g.hasScore) continue;
        // Keyed on the game id, not the URL: the same game has been served
        // under both /winter-cup/ and /super-winter-cup/, and one stored URL
        // carries a trailing newline. Either would import a duplicate.
        if (!byId.has(g.gameId)) byId.set(g.gameId, g);
      }
    } catch (err) {
      errors.push(`${league.name}: ${(err as Error).message}`);
    }
  }

  return { games: [...byId.values()], errors };
}
