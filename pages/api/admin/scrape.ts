import { requireAuth }  from "@/server/auth";
import { ScrapeSchema } from "@/schemas/scrape";
import prisma from "@/server/db/client";
import { scrapeGameFromUrl, ScrapeError } from "@/server/services/scrape-game";
import { resolve } from "@/domain/import/resolve";
import type { SeasonLeagueRef } from "@/domain/import/resolve";

async function resolverInputs(): Promise<{ roster: { id: string; number: number }[]; seasonLeagues: SeasonLeagueRef[] }> {
  const [players, seasonLeagues] = await Promise.all([
    prisma.player.findMany({
      where:   { isActive: true },
      orderBy: { number: "asc" },
      select:  { id: true, number: true },
    }),
    prisma.seasonLeague.findMany({ include: { league: true, season: true } }),
  ]);

  return {
    roster: players,
    seasonLeagues: seasonLeagues.map(sl => ({
      id:          sl.id,
      leagueSlug:  sl.league.slug,
      seasonStart: sl.season.startDate?.toISOString() ?? null,
      seasonEnd:   sl.season.endDate?.toISOString() ?? null,
    })),
  };
}

export default requireAuth(async function handler(req: any, res: any) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const parsed = ScrapeSchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid URL" });

  try {
    const { data, gameState } = await scrapeGameFromUrl(parsed.data.url);
    const { roster, seasonLeagues } = await resolverInputs();

    let resolved;
    try {
      resolved = resolve(data, roster, seasonLeagues);
    } catch (err) {
      // resolve() throws only when our team is missing from the scraped teams.
      return res.status(422).json({ error: (err as Error).message });
    }

    return res.status(200).json({ ok: true, data, gameState, ...resolved });
  } catch (err) {
    if (err instanceof ScrapeError)
      return res.status(err.status).json({ error: err.message });
    return res.status(500).json({ error: "Unexpected error" });
  }
});
