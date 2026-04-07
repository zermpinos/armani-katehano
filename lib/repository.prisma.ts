/**
 * lib/repository.prisma.js
 * New data layer — reads from Neon via Prisma.
 * Exports the same function signatures as lib/repository.js
 * so pages need no changes when we swap.
 */

import prisma from "./prisma";
import { calcEff, aggregatesToStatsMap } from "./stats";

// ─── Config (hardcoded for now — no longer stored in Redis) ──────────────────

export async function getConfig() {
  // Prefer the most recent season that has at least one game — avoids a
  // future empty season being picked as "current" before any games are added.
  const seasonWithGames = await prisma.season.findFirst({
    where: { seasonLeagues: { some: { games: { some: {} } } } },
    orderBy: { year: "desc" },
  });
  const season = seasonWithGames ?? await prisma.season.findFirst({
    orderBy: { year: "desc" },
  });
  return { currentSeason: season?.name ?? "2025-26" };
}

// ─── Seasons ──────────────────────────────────────────────────────────────────

export async function getSeasons() {
  const seasons = await prisma.season.findMany({
    orderBy: { year: "asc" },
  });
  return seasons.map(s => s.name);
}

// ─── Players ─────────────────────────────────────────────────────────────────

export async function getPlayers() {
  const players = await prisma.player.findMany({
    orderBy: { number: "asc" },
  });
  return players.map(p => ({
    id:       p.id,
    slug:     p.slug,
    number:   p.number,
    name:     p.name,
    position: p.position,
    height:   p.height ?? "",
    weight:   p.weight ?? "",
    photoUrl: p.photoUrl ?? null,
    isActive: p.isActive,
  }));
}

// ─── Games (season-scoped) ────────────────────────────────────────────────────

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
    score:        `${g.teamScore}–${g.opponentScore}`,
    league:       g.seasonLeague.league.slug,
    offRating:    g.offRating ?? null,
    defRating:    g.defRating ?? null,
    boxScore: g.playerStats.map(r => ({
      pid:  r.playerId,
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

// ─── Stats (season-scoped) ────────────────────────────────────────────────────

export async function getStats(seasonName: string, leagueSlug: string | null = null) {
  const aggregates = await prisma.playerSeasonAggregate.findMany({
    where: {
      seasonLeague: {
        season: { name: seasonName },
        ...(leagueSlug ? { league: { slug: leagueSlug } } : {}),
      },
    },
    include: { player: true },
  });

  return aggregatesToStatsMap(aggregates);
}

// ─── All games (cross-season, for Games page filtering) ──────────────────────
// Box scores are NOT included here — they are fetched on demand via getBoxScore()
// so the ISR props payload stays bounded regardless of history length.

export async function getAllGames() {
  const games = await prisma.game.findMany({
    include: {
      seasonLeague: { include: { season: true, league: true } },
      // Fetch only the top scorer per game (highest pts among players with minutes)
      // rather than full box scores, to keep the props payload small.
      playerStats: {
        where:   { minutes: { gt: 0 } },
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
      score:       `${g.teamScore}–${g.opponentScore}`,
      season:      g.seasonLeague.season.name,
      league:      g.seasonLeague.league.slug,
      leagueName:  g.seasonLeague.league.name,
      sourceUrl:   g.sourceUrl ?? null,
      youtubeUrl:  g.youtubeUrl ?? null,
      offRating:   g.offRating ?? null,
      defRating:   g.defRating ?? null,
      // Pre-computed top scorer so game cards can show it without a full box score
      topScorer:   top ? { name: top.player.name, pts: top.pts } : null,
    };
  });
}

// ─── Box score for a single game (fetched on demand) ─────────────────────────

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
    WHERE pgs."gameId" = ${gameId} AND pgs."minutes" > 0
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

// ─── Upcoming Games ───────────────────────────────────────────────────────────

export async function getUpcomingGames() {
  const now = new Date();
  const rows = await prisma.upcomingGame.findMany({
    where: { scheduledFor: { gte: now } },
    orderBy: { scheduledFor: "asc" },
    take: 10,
  });
  return rows.map(g => ({
    id:           g.id,
    opponent:     g.opponent,
    scheduledFor: g.scheduledFor.toISOString(),
    location:     g.location,
    competition:  g.competition ?? null,
    notes:        g.notes ?? null,
  }));
}

export async function getAllUpcomingGames() {
  const rows = await prisma.upcomingGame.findMany({
    orderBy: { scheduledFor: "asc" },
  });
  return rows.map(g => ({
    id:           g.id,
    opponent:     g.opponent,
    scheduledFor: g.scheduledFor.toISOString(),
    location:     g.location,
    competition:  g.competition ?? null,
    notes:        g.notes ?? null,
  }));
}

// ─── Batch helpers ────────────────────────────────────────────────────────────

export async function getAllPublicData(seasonName = null) {
  const [config, seasons, players] = await Promise.all([
    getConfig(),
    getSeasons(),
    getPlayers(),
  ]);

  const activeSeason = seasonName ?? config.currentSeason;

  const [games, stats, upcomingGames] = await Promise.all([
    getGames(activeSeason),
    getStats(activeSeason),
    getUpcomingGames(),
  ]);

  return {
    config,
    seasons,
    currentSeason: activeSeason,
    players,
    games,
    stats,
    upcomingGames,
  };
}

export async function getAllSeasonsStats(seasons: string[]) {
  if (seasons.length === 0) return {};

  // Single query for all seasons — avoids N separate DB round-trips.
  const allAggregates = await prisma.playerSeasonAggregate.findMany({
    where: { seasonLeague: { season: { name: { in: seasons } } } },
    include: {
      player:       true,
      seasonLeague: { include: { season: true } },
    },
  });

  // Group rows by season name, then process each group with the shared helper.
  const bySeason: Record<string, any[]> = Object.fromEntries(seasons.map((s: string) => [s, []]));
  for (const agg of allAggregates) {
    const name = agg.seasonLeague.season.name;
    if (bySeason[name]) bySeason[name].push(agg);
  }

  return Object.fromEntries(
    seasons.map((s: string) => [s, aggregatesToStatsMap(bySeason[s])])
  );
}
