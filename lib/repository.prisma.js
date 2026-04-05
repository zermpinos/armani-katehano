/**
 * lib/repository.prisma.js
 * New data layer -- reads from Neon via Prisma.
 * Exports the same function signatures as lib/repository.js
 * so pages need no changes when we swap.
 */

import prisma from "./prisma.js";
import { calcEff, mergeAggregates } from "./stats.js";

// ─── Config (hardcoded for now -- no longer stored in Redis) ──────────────────

export async function getConfig() {
  // Prefer the most recent season that has at least one game -- avoids a
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

export async function getGames(seasonName, leagueSlug = null) {
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

export async function getStats(seasonName, leagueSlug = null) {
  const aggregates = await prisma.playerSeasonAggregate.findMany({
    where: {
      seasonLeague: {
        season: { name: seasonName },
        ...(leagueSlug ? { league: { slug: leagueSlug } } : {}),
      },
    },
    include: { player: true },
  });

  // If multiple leagues, merge by player using shared mergeAggregates.
  // Rate stats use weighted average by gp; percentages are recomputed from
  // summed raw totals for statistical accuracy.
  const merged = {};

  for (const agg of aggregates) {
    const pid = agg.playerId;
    if (!merged[pid]) {
      merged[pid] = { ...agg };
    } else {
      merged[pid] = mergeAggregates(merged[pid], agg);
    }
  }

  // Helper: compute percentage from totals, return 0 if no attempts
  const pct = (m, a) => a > 0 ? +((m / a) * 100).toFixed(1) : 0;

  // Shape into the format pages expect: { [pid]: SeasonStats }
  const statsMap = {};
  for (const [pid, agg] of Object.entries(merged)) {
    const fgaTotal  = agg.fgaTotal  ?? 0;
    const fg2aTotal = agg.fg2aTotal ?? 0;
    const fg3aTotal = agg.fg3aTotal ?? 0;
    const ftaTotal  = agg.ftaTotal  ?? 0;

    statsMap[pid] = {
      ppg:    +agg.ptsAvg.toFixed(1),
      rpg:    +agg.rebAvg.toFixed(1),
      orpg:   +agg.orbAvg.toFixed(1),
      drpg:   +agg.drbAvg.toFixed(1),
      apg:    +agg.astAvg.toFixed(1),
      spg:    +agg.stlAvg.toFixed(1),
      bpg:    +agg.blkAvg.toFixed(1),
      tpg:    +agg.toAvg.toFixed(1),
      fpg:    +agg.pfAvg.toFixed(1),
      mpg:    +agg.minutesAvg.toFixed(1),
      // Percentages computed from raw totals -- accurate across leagues
      fgPct:  pct(agg.fgmTotal  ?? 0, fgaTotal),
      fg2Pct: pct(agg.fg2mTotal ?? 0, fg2aTotal),
      fg3Pct: pct(agg.fg3mTotal ?? 0, fg3aTotal),
      ftPct:  ftaTotal > 0 ? pct(agg.ftmTotal ?? 0, ftaTotal) : null,
      ftmPg:  agg.gp > 0 ? +((agg.ftmTotal ?? 0) / agg.gp).toFixed(1) : 0,
      ftaPg:  agg.gp > 0 ? +((agg.ftaTotal ?? 0) / agg.gp).toFixed(1) : 0,
      // tsPct stays as weighted avg -- requires pts/fga/fta totals together
      tsPct:  +agg.tsPct.toFixed(1),
      eff:    +((agg.effAvg ?? 0).toFixed(1)),
      gp:     agg.gp,
      // Raw shot totals -- carried so buildAllTimeStatsMap can sum across seasons
      // and recompute percentages from raw values (statistically correct).
      fgm:  agg.fgmTotal  ?? 0,
      fga:  agg.fgaTotal  ?? 0,
      fg2m: agg.fg2mTotal ?? 0,
      fg2a: agg.fg2aTotal ?? 0,
      fg3m: agg.fg3mTotal ?? 0,
      fg3a: agg.fg3aTotal ?? 0,
      ftm:  agg.ftmTotal  ?? 0,
      fta:  agg.ftaTotal  ?? 0,
    };
  }

  return statsMap;
}

// ─── All games (cross-season, for Games page filtering) ──────────────────────
// Box scores are NOT included here -- they are fetched on demand via getBoxScore()
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
      score:       `${g.teamScore}-${g.opponentScore}`,
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

export async function getBoxScore(gameId) {
  const stats = await prisma.playerGameStat.findMany({
    where:   { gameId },
    include: { player: { select: { id: true, name: true, number: true } } },
  });
  return stats.map(r => ({
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

  const [games, stats] = await Promise.all([
    getGames(activeSeason),
    getStats(activeSeason),
  ]);

  return {
    config,
    seasons,
    currentSeason: activeSeason,
    players,
    games,
    stats,
  };
}

export async function getAllSeasonsStats(seasons) {
  const results = await Promise.all(seasons.map(s => getStats(s)));
  return Object.fromEntries(seasons.map((s, i) => [s, results[i]]));
}
