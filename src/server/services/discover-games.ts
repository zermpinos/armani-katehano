import "@/server/_internal/node-only";
import { fetchGuarded } from "@/server/services/scrape-game";
import { parseTeamSchedule, type ListedGame } from "@/server/integrations/scraper/team-schedule";

// Read by name rather than indexed, so the env lookup stays a static access.
const LISTINGS = [
  { key: "SCRAPE_LISTING_URL_MEN", read: () => process.env.SCRAPE_LISTING_URL_MEN },
  { key: "SCRAPE_LISTING_URL_CUP", read: () => process.env.SCRAPE_LISTING_URL_CUP },
] as const;

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

  for (const { key, read } of LISTINGS) {
    const url = read();
    if (!url) { errors.push(`${key} is not set`); continue; }

    try {
      for (const g of parseTeamSchedule(await fetchGuarded(url), url)) {
        if (!g.hasScore) continue;
        // Keyed on the game id, not the URL: the same game has been served
        // under both /winter-cup/ and /super-winter-cup/, and one stored URL
        // carries a trailing newline. Either would import a duplicate.
        if (!byId.has(g.gameId)) byId.set(g.gameId, g);
      }
    } catch (err) {
      errors.push(`${key}: ${(err as Error).message}`);
    }
  }

  return { games: [...byId.values()], errors };
}
