import prisma               from "@/server/db/client";
import { recalcAggregates } from "@/server/services/stats-recalc";
import { BoxScoreRowSchema } from "@/schemas/box-score";
import {
  parseGreekDate,
  detectLeagueSlug,
  parseMinutes,
} from "@/domain/calendar/greek-date";

const AK_IDENTIFIERS = ["ARMANI", "KATEHANO"];

const ISR_PATHS = ["/", "/players", "/leaderboard", "/games", "/team-stats"];

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ImportError";
  }
}

export interface ImportResult {
  gameId: string;
  playersImported: number;
  skipped: string[];
}

export async function importGame(
  payload: { data: any },
  opts?: { revalidate?: (path: string) => Promise<void> },
): Promise<ImportResult> {
  const { data } = payload;

  if (!data?.game || !Array.isArray(data?.teams))
    throw new ImportError("Missing game or teams in payload", 400);

  const { game, teams, url: sourceUrl } = data;

  if (!game.finalScore || !game.homeTeam || !game.awayTeam)
    throw new ImportError("Missing finalScore, homeTeam or awayTeam", 400);

  const akTeam = teams.find((t: any) =>
    AK_IDENTIFIERS.some(id => t.name.toUpperCase().includes(id))
  );
  if (!akTeam) {
    const found = teams.map((t: any) => `"${t.name}"`).join(", ");
    throw new ImportError(`ARMANI KATEHANO team not found. Teams in payload: ${found}`, 400);
  }

  const isHome = AK_IDENTIFIERS.some(id =>
    game.homeTeam.toUpperCase().includes(id)
  );

  const akScore  = Number(isHome ? game.finalScore.home : game.finalScore.away);
  const oppScore = Number(isHome ? game.finalScore.away : game.finalScore.home);

  if (!Number.isFinite(akScore) || !Number.isFinite(oppScore))
    throw new ImportError(`Invalid finalScore values: home=${game.finalScore.home}, away=${game.finalScore.away}`, 400);

  const oppTeamName = isHome ? game.awayTeam : game.homeTeam;
  const result      = akScore > oppScore ? "W" : akScore < oppScore ? "L" : "T";
  const playedOn    = parseGreekDate(game.date) as Date;

  const offRating = Number.isFinite(Number(game.offRating)) ? Number(game.offRating) : null;
  const defRating = Number.isFinite(Number(game.defRating)) ? Number(game.defRating) : null;

  const leagueKey = detectLeagueSlug(sourceUrl);
  if (!leagueKey)
    throw new ImportError("Could not detect a league from the source URL -- import aborted", 422);

  let seasonLeagueId: string;

  if (leagueKey === 'men') {
    // /men/ URLs are shared by Rookie, BC6, BC8 -- resolve by finding the single
    // active non-wintercup SeasonLeague whose season covers the game date.
    const candidates = await prisma.seasonLeague.findMany({
      where: {
        league:  { slug: { not: { contains: 'winter' } } },
        season:  { OR: [{ endDate: null }, { endDate: { gte: playedOn } }] },
      },
      include: { league: true },
      orderBy: { season: { startDate: 'desc' } },
    });
    if (candidates.length === 0)
      throw new ImportError(
        `No active SeasonLeague found for game date ${playedOn.toISOString().slice(0, 10)} -- ensure the current season is configured`,
        422,
      );
    if (candidates.length > 1)
      throw new ImportError(
        `Multiple active leagues match (${candidates.map(c => c.league.slug).join(', ')}) -- set non-overlapping season end dates`,
        422,
      );
    seasonLeagueId = candidates[0].id;
  } else {
    const league = await prisma.league.findFirst({ where: { slug: leagueKey } });
    if (!league)
      throw new ImportError(`No league found for slug "${leagueKey}" -- create it first`, 422);
    const sl = await prisma.seasonLeague.findFirst({
      where: {
        leagueId: league.id,
        season:   { OR: [{ endDate: null }, { endDate: { gte: playedOn } }] },
      },
      orderBy: { season: { startDate: 'desc' } },
    });
    if (!sl)
      throw new ImportError(`No active SeasonLeague found for league "${leagueKey}" -- ensure the current season is configured`, 422);
    seasonLeagueId = sl.id;
  }

  const allPlayers = await prisma.player.findMany({ where: { isActive: true } });
  const playerMap  = Object.fromEntries(allPlayers.map(p => [p.number, p.id]));

  const skipped: string[] = [];
  const boxScore = akTeam.players
    .filter((p: any) => parseMinutes(p.MIN) > 0)
    .map((p: any) => {
      const playerId = playerMap[p["#"]];
      if (!playerId) { skipped.push(`#${p["#"]} ${p.Players}`); return null; }

      const fg2m = p["2PTS"]?.made      ?? 0;
      const fg2a = p["2PTS"]?.attempted ?? 0;
      const fg3m = p["3PTS"]?.made      ?? 0;
      const fg3a = p["3PTS"]?.attempted ?? 0;

      return {
        playerId,
        minutes:   parseMinutes(p.MIN),
        pts:       p.PTS  ?? 0,
        reb:       p.REB  ?? 0,
        orb:       p.OREB ?? 0,
        drb:       p.DREB ?? 0,
        ast:       p.AST  ?? 0,
        stl:       p.STL  ?? 0,
        blk:       p.BLK  ?? 0,
        tov:       p.TO   ?? 0,
        pf:        p.PF   ?? 0,
        fg2m, fg2a, fg3m, fg3a,
        fgm:       fg2m + fg3m,
        fga:       fg2a + fg3a,
        ftm:       p.FT?.made      ?? 0,
        fta:       p.FT?.attempted ?? 0,
        plusMinus: 0,
      };
    })
    .filter(Boolean);

  const validationErrors: any[] = [];
  const validatedBoxScore = boxScore.map((row: any, i: number) => {
    const r = BoxScoreRowSchema.safeParse(row);
    if (!r.success) { validationErrors.push({ row: i, errors: r.error.flatten() }); return null; }
    return r.data;
  }).filter(Boolean);

  if (validationErrors.length > 0)
    throw new ImportError("Invalid box score data", 400, { details: validationErrors });

  const boxSum = validatedBoxScore.reduce((acc: number, row: any) => acc + (row.pts ?? 0), 0);
  if (boxSum !== akScore)
    throw new ImportError(`Box score points (${boxSum}) do not match teamScore (${akScore}). Diff: ${boxSum - akScore}`, 422);

  let gameId: string;

  try {
    await prisma.$transaction(async (tx) => {
      if (sourceUrl) {
        const duplicate = await tx.game.findUnique({ where: { sourceUrl } });
        if (duplicate) throw Object.assign(new Error("DUPLICATE"), { gameId: duplicate.id });
      }

      const g = await tx.game.create({
        data: {
          seasonLeagueId,
          opponent:      oppTeamName,
          location:      isHome ? "home" : "away",
          teamScore:     akScore,
          opponentScore: oppScore,
          result,
          playedOn,
          sourceUrl:     sourceUrl ?? null,
          offRating:     offRating ?? null,
          defRating:     defRating ?? null,
        },
      });
      gameId = g.id;

      if (validatedBoxScore.length) {
        await tx.playerGameStat.createMany({
          data: validatedBoxScore.map((row: any) => ({ ...row, gameId: g.id })),
        });
      }

      await recalcAggregates(seasonLeagueId, tx);

      if (sourceUrl) {
        const upcoming = await tx.upcomingGame.findUnique({ where: { sourceUrl } });
        if (upcoming) {
          await tx.gameImportJob.updateMany({
            where: { upcomingGameId: upcoming.id, state: "PENDING" },
            data:  { state: "IMPORTED", importedGameId: g.id, importedAt: new Date() },
          });
        }
      }
    });
  } catch (err) {
    if ((err as any).message === "DUPLICATE") {
      const dupGameId = (err as any).gameId as string;
      if (sourceUrl) {
        const upcoming = await prisma.upcomingGame.findUnique({ where: { sourceUrl } });
        if (upcoming) {
          await prisma.gameImportJob.updateMany({
            where: { upcomingGameId: upcoming.id, state: "PENDING" },
            data:  { state: "IMPORTED", importedGameId: dupGameId, importedAt: new Date() },
          });
        }
      }
      throw Object.assign(new ImportError("This game has already been imported.", 409), { gameId: dupGameId });
    }
    throw err;
  }

  if (opts?.revalidate) {
    await Promise.allSettled(ISR_PATHS.map(p => opts.revalidate!(p)));
  }

  return { gameId: gameId!, playersImported: validatedBoxScore.length, skipped };
}
