import "@/server/_internal/node-only";
import prisma from "@/server/db/client";
import { scrapeGameFromUrl, ScrapeError } from "@/server/services/scrape-game";
import { captureImportDraft } from "@/server/services/import-commit";
import { resolve } from "@/domain/import/resolve";
import { verify } from "@/domain/import/verify";
import type { SeasonLeagueRef, ResolveResult } from "@/domain/import/resolve";
import type { ClassifyResult } from "@/domain/import/classify";
import type { GateResult } from "@/domain/import/verify";

async function resolverInputs(): Promise<{ roster: { id: string; number: number }[]; seasonLeagues: SeasonLeagueRef[] }> {
  const [players, seasonLeagues] = await Promise.all([
    prisma.player.findMany({
      where:   { isActive: true },
      orderBy: { number: "asc" },
      select:  { id: true, number: true },
    }),
    // An archived season is closed, so a scrape must never resolve into it.
    // Without this the first game of a new season lands in the old one, since
    // a season with no end date counts as covering every date.
    prisma.seasonLeague.findMany({
      where:   { season: { archivedAt: null } },
      include: { league: true, season: true },
    }),
  ]);

  return {
    roster: players,
    seasonLeagues: seasonLeagues.map(sl => ({
      id:           sl.id,
      leagueSlug:   sl.league.slug,
      organization: sl.league.organization,
      sourceSlug:   sl.league.sourceSlug,
      seasonStart:  sl.season.startDate?.toISOString() ?? null,
      seasonEnd:    sl.season.endDate?.toISOString() ?? null,
    })),
  };
}

export interface PipelineResult extends ResolveResult {
  data:      any;
  gameState: ClassifyResult;
  gate:      GateResult;
}

// Single path from URL to reviewable draft, shared by the admin's scrape route
// and the poll, so the two can never drift into judging a scrape differently.
export async function scrapeAndResolve(
  url: string,
  opts: { leagueSlug?: string | null } = {},
): Promise<PipelineResult> {
  const { data, gameState, bytesHash } = await scrapeGameFromUrl(url);
  const { roster, seasonLeagues } = await resolverInputs();

  await captureImportDraft(url, data, bytesHash);

  try {
    return { data, gameState, gate: verify(data), ...resolve(data, roster, seasonLeagues, opts) };
  } catch (err) {
    // resolve() throws only when our team is missing from the scraped teams.
    throw new ScrapeError((err as Error).message, 422);
  }
}
