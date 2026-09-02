import "@/server/_internal/node-only";
import prisma from "@/server/db/client";
import { calcEff, teamRatingsFromBox, type TeamRatingsBoxRow } from "@/domain/stats";

// Derived per read rather than stored, so a later box-score edit cannot leave
// a stale rating behind. One decimal, as displayed.
function ratingsOf(g: { teamScore: number; opponentScore: number; playerStats: TeamRatingsBoxRow[] }) {
  const r = teamRatingsFromBox(g.playerStats, g.teamScore, g.opponentScore);
  return r ? { offRating: +r.offRating.toFixed(1), defRating: +r.defRating.toFixed(1) } : { offRating: null, defRating: null };
}

export async function getGames(seasonName: string, leagueSlug: string | null = null) {
  const where = {
    seasonLeague: {
      season: { name: seasonName },
      ...(leagueSlug ? { league: { slug: leagueSlug } } : {}),
    },
  };

  const games = await prisma.game.findMany({
    where,
    include: {
      seasonLeague: { include: { league: true } },
      playerStats:  true,
    },
    orderBy: { playedOn: "desc" },
  });

  return games.map(g => ({
    id:           g.id,
    date:         g.playedOn.toISOString().split("T")[0],
    opponent:     g.opponent,
    home:         g.location === "home",
    result:       g.result,
    score:        `${g.teamScore}-${g.opponentScore}`,
    league:       g.seasonLeague.league.slug,
    round:        g.round,
    ...ratingsOf(g),
    boxScore: g.playerStats.map(r => ({
      pid:  r.playerId,
      played: r.played,
      min:  r.minutes,
      pts:  r.pts,
      reb:  r.reb,
      orb:  r.orb,
      drb:  r.drb,
      ast:  r.ast,
      stl:  r.stl,
      blk:  r.blk,
      tov:  r.tov,
      pf:   r.pf,
      fgm:  r.fgm,
      fga:  r.fga,
      fg2m: r.fg2m,
      fg2a: r.fg2a,
      fg3m: r.fg3m,
      fg3a: r.fg3a,
      ftm:  r.ftm,
      fta:  r.fta,
      eff:  calcEff(r),
    })),
  }));
}

export async function getAllGames() {
  const games = await prisma.game.findMany({
    include: {
      seasonLeague: { include: { season: true, league: true } },
      // Fetch only the top scorer per game (highest pts among players with minutes)
      // rather than full box scores, to keep the props payload small.
      playerStats: {
        where:   { played: true },
        orderBy: { pts: "desc" },
        take:    1,
        include: { player: { select: { name: true } } },
      },
    },
    orderBy: { playedOn: "desc" },
  });

  return games.map(g => {
    const top = g.playerStats[0];
    return {
      id:          g.id,
      date:        g.playedOn.toISOString().split("T")[0],
      opponent:    g.opponent,
      home:        g.location === "home",
      result:      g.result,
      score:       `${g.teamScore}-${g.opponentScore}`,
      season:      g.seasonLeague.season.name,
      league:      g.seasonLeague.league.slug,
      leagueName:  g.seasonLeague.league.name,
      sourceUrl:   g.sourceUrl ?? null,
      youtubeUrl:  g.youtubeUrl ?? null,
      round:       g.round,
      // No ratings: this query fetches only the top scorer, not the full box.
      // Pre-computed top scorer so game cards can show it without a full box score
      topScorer:   top ? { name: top.player.name, pts: top.pts } : null,
    };
  });
}

export async function getBoxScore(gameId: string) {
  const stats = await prisma.$queryRaw`
    SELECT
      pgs."playerId" as "pid",
      pgs."minutes" as "min",
      pgs."pts",
      pgs."reb",
      pgs."orb",
      pgs."drb",
      pgs."ast",
      pgs."stl",
      pgs."blk",
      pgs."tov",
      pgs."pf",
      pgs."fgm",
      pgs."fga",
      pgs."fg2m",
      pgs."fg2a",
      pgs."fg3m",
      pgs."fg3a",
      pgs."ftm",
      pgs."fta"
    FROM "PlayerGameStat" pgs
    WHERE pgs."gameId" = ${gameId} AND pgs."played"
    ORDER BY (SELECT "number" FROM "Player" WHERE "id" = pgs."playerId") ASC
  ` as any[];

  return stats.map(r => ({
    pid:  r.pid,
    min:  r.min,
    pts:  r.pts,
    reb:  r.reb,
    orb:  r.orb,
    drb:  r.drb,
    ast:  r.ast,
    stl:  r.stl,
    blk:  r.blk,
    tov:  r.tov,
    pf:   r.pf,
    fgm:  r.fgm,
    fga:  r.fga,
    fg2m: r.fg2m,
    fg2a: r.fg2a,
    fg3m: r.fg3m,
    fg3a: r.fg3a,
    ftm:  r.ftm,
    fta:  r.fta,
    eff:  calcEff(r),
  }));
}

export async function getGameById(id: string) {
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      seasonLeague: {
        include: { season: true, league: true },
      },
      playerStats: {
        where:   { played: true },
        include: {
          player: {
            select: { id: true, slug: true, name: true, number: true, position: true },
          },
        },
      },
    },
  });

  if (!game) return null;

  return {
    id:         game.id,
    date:       game.playedOn.toISOString().split("T")[0],
    opponent:   game.opponent,
    home:       game.location === "home",
    result:     game.result as "W" | "L",
    score:      `${game.teamScore}-${game.opponentScore}`,
    season:     game.seasonLeague.season.name,
    leagueName: game.seasonLeague.league.name,
    sourceUrl:  game.sourceUrl  ?? null,
    youtubeUrl: game.youtubeUrl ?? null,
    boxScore: game.playerStats
      .sort((a, b) => a.player.number - b.player.number)
      .map(r => ({
        pid:      r.player.id,
        slug:     r.player.slug,
        name:     r.player.name,
        number:   r.player.number,
        position: r.player.position,
        min:  r.minutes,
        pts:  r.pts,
        reb:  r.reb,
        orb:  r.orb,
        drb:  r.drb,
        ast:  r.ast,
        stl:  r.stl,
        blk:  r.blk,
        tov:  r.tov,
        pf:   r.pf,
        fgm:  r.fgm,
        fga:  r.fga,
        fg2m: r.fg2m,
        fg2a: r.fg2a,
        fg3m: r.fg3m,
        fg3a: r.fg3a,
        ftm:  r.ftm,
        fta:  r.fta,
        eff:  calcEff(r),
      })),
  };
}

export async function getGameIds(): Promise<string[]> {
  const games = await prisma.game.findMany({ select: { id: true } });
  return games.map(g => g.id);
}
