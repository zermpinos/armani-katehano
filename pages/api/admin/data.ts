import { requireAuth } from "@/server/auth";
import { prodError } from "@/domain/shared/format";
import { MAX_GAMES_PER_PAGE } from "@/domain/shared/constants";
import prisma from "@/server/db/client";
import { z } from "zod";

// gameId "new" asks for the empty form: every player and the current season's leagues.
const QuerySchema = z.object({
  all:    z.literal("1").optional(),
  gameId: z.union([z.literal("new"), z.string().cuid()]).optional(),
});

const LEAGUE_INCLUDE = { league: true, season: true } as const;

type SeasonLeagueRow = { id: string; league: { name: string; slug: string }; season: { name: string } };
type GameRow = {
  id: string; seasonLeagueId: string; playedOn: Date; opponent: string; location: string | null;
  result: string; teamScore: number; opponentScore: number; round: string;
};

function toSeasonLeague(sl: SeasonLeagueRow) {
  return { id: sl.id, leagueName: sl.league.name, leagueSlug: sl.league.slug, seasonName: sl.season.name };
}

function toListGame(g: GameRow) {
  return {
    id:             g.id,
    seasonLeagueId: g.seasonLeagueId,
    date:           g.playedOn.toISOString().slice(0, 10),
    opponent:       g.opponent,
    home:           g.location === "home",
    result:         g.result,
    teamScore:      g.teamScore,
    opponentScore:  g.opponentScore,
    round:          g.round,
  };
}

async function listPayload(all: boolean) {
  const season = all ? null : await prisma.season.findFirst({ orderBy: { year: "desc" } });
  if (!all && !season) return { currentSeason: null, games: [], seasonLeagues: [], olderCount: 0 };
  const seasonLeagues = await prisma.seasonLeague.findMany({
    where:   season ? { seasonId: season.id } : {},
    include: LEAGUE_INCLUDE,
    orderBy: [{ season: { year: "desc" } }, { league: { name: "asc" } }],
  });
  const ids = seasonLeagues.map(sl => sl.id);
  const [games, olderCount] = await Promise.all([
    prisma.game.findMany({
      where:   { seasonLeagueId: { in: ids } },
      orderBy: { playedOn: "desc" },
      take:    MAX_GAMES_PER_PAGE,
    }),
    season ? prisma.game.count({ where: { seasonLeagueId: { notIn: ids } } }) : Promise.resolve(0),
  ]);
  return {
    currentSeason: season?.name ?? null,
    games:         games.map(toListGame),
    seasonLeagues: seasonLeagues.map(toSeasonLeague),
    olderCount,
  };
}

async function editPayload(gameId: string) {
  const players = await prisma.player.findMany({
    orderBy: { number: "asc" },
    select:  { id: true, name: true, number: true, position: true, isActive: true },
  });
  if (gameId === "new") {
    const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
    const seasonLeagues = season ? await prisma.seasonLeague.findMany({
      where: { seasonId: season.id }, include: LEAGUE_INCLUDE, orderBy: { league: { name: "asc" } },
    }) : [];
    return { game: null, players, seasonLeagues: seasonLeagues.map(toSeasonLeague) };
  }
  const game = await prisma.game.findUnique({
    where:   { id: gameId },
    include: { seasonLeague: true, playerStats: true },
  });
  if (!game) return null;
  // The game's own season, so a past game keeps its league in the picker.
  const seasonLeagues = await prisma.seasonLeague.findMany({
    where: { seasonId: game.seasonLeague.seasonId }, include: LEAGUE_INCLUDE, orderBy: { league: { name: "asc" } },
  });
  return {
    game: {
      ...toListGame(game),
      sourceUrl:  game.sourceUrl ?? null,
      youtubeUrl: game.youtubeUrl ?? null,
      notes:      game.notes ?? "",
      boxScore:   game.playerStats.map(r => ({
        playerId: r.playerId, minutes: r.minutes,
        pts: r.pts, reb: r.reb, orb: r.orb, drb: r.drb, ast: r.ast, stl: r.stl, blk: r.blk, tov: r.tov, pf: r.pf,
        fgm: r.fgm, fga: r.fga, fg2m: r.fg2m, fg2a: r.fg2a, fg3m: r.fg3m, fg3a: r.fg3a, ftm: r.ftm, fta: r.fta,
      })),
    },
    players,
    seasonLeagues: seasonLeagues.map(toSeasonLeague),
  };
}

async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const query = QuerySchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: "Invalid query" });
  try {
    if (query.data.gameId) {
      const payload = await editPayload(query.data.gameId);
      return payload ? res.status(200).json(payload) : res.status(404).json({ error: "Game not found" });
    }
    return res.status(200).json(await listPayload(query.data.all === "1"));
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);
