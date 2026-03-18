/**
 * lib/repository.prisma.js
 * New data layer -- reads from Neon via Prisma.
 * Exports the same function signatures as lib/repository.js
 * so pages need no changes when we swap.
 */

import prisma from "./prisma.js";

// ─── Config (hardcoded for now -- no longer stored in Redis) ──────────────────

export async function getConfig() {
  const season = await prisma.season.findFirst({
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
    boxScore:     g.playerStats.map(r => ({
      pid:  r.playerId,
      min:  r.minutes,
      pts:  r.pts,
      reb:  r.reb,
      ast:  r.ast,
      stl:  r.stl,
      blk:  r.blk,
      tov:  r.to,
      pf:   r.pf,
      fgm:  r.fgm,
      fga:  r.fga,
      fg3m: r.tpm,
      fg3a: r.tpa,
      ftm:  r.ftm,
      fta:  r.fta,
      eff:  r.pts + r.reb + r.ast + r.stl + r.blk
            - (r.fga - r.fgm) - (r.fta - r.ftm) - r.to,
    })),
  }));
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export async function getSchedule(seasonName) {
  // Schedule not yet implemented in new schema -- return empty array
  return [];
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

  // If multiple leagues, merge by player -- weighted average by gp
  const merged = {};

  for (const agg of aggregates) {
    const pid = agg.playerId;
    if (!merged[pid]) {
      merged[pid] = { ...agg, _count: 1 };
      continue;
    }

    const prev = merged[pid];
    const totalGp = prev.gp + agg.gp;

    // Weighted average for rate stats
    const wavg = (a, b) =>
      totalGp > 0 ? +((a * prev.gp + b * agg.gp) / totalGp).toFixed(2) : 0;

    merged[pid] = {
      ...prev,
      gp:         totalGp,
      ptsAvg:     wavg(prev.ptsAvg,    agg.ptsAvg),
      rebAvg:     wavg(prev.rebAvg,    agg.rebAvg),
      astAvg:     wavg(prev.astAvg,    agg.astAvg),
      stlAvg:     wavg(prev.stlAvg,    agg.stlAvg),
      blkAvg:     wavg(prev.blkAvg,    agg.blkAvg),
      toAvg:      wavg(prev.toAvg,     agg.toAvg),
      pfAvg:      wavg(prev.pfAvg,     agg.pfAvg),
      minutesAvg: wavg(prev.minutesAvg,agg.minutesAvg),
      fgPct:      wavg(prev.fgPct,     agg.fgPct),
      tpPct:      wavg(prev.tpPct,     agg.tpPct),
      ftPct:      wavg(prev.ftPct,     agg.ftPct),
      tsPct:      wavg(prev.tsPct,     agg.tsPct),
      ptsTotal:   prev.ptsTotal  + agg.ptsTotal,
      rebTotal:   prev.rebTotal  + agg.rebTotal,
      astTotal:   prev.astTotal  + agg.astTotal,
    };
  }

  // Shape into the format pages expect: { [pid]: SeasonStats }
  const statsMap = {};
  for (const [pid, agg] of Object.entries(merged)) {
    statsMap[pid] = {
      ppg:    +agg.ptsAvg.toFixed(1),
      rpg:    +agg.rebAvg.toFixed(1),
      apg:    +agg.astAvg.toFixed(1),
      spg:    +agg.stlAvg.toFixed(1),
      bpg:    +agg.blkAvg.toFixed(1),
      tpg:    +agg.toAvg.toFixed(1),
      fpg:    +agg.pfAvg.toFixed(1),
      mpg:    +agg.minutesAvg.toFixed(1),
      fgPct:  +agg.fgPct.toFixed(1),
      fg3Pct: +agg.tpPct.toFixed(1),
      ftPct:  +agg.ftPct.toFixed(1),
      tsPct:  +agg.tsPct.toFixed(1),
      eff:    +agg.ptsAvg.toFixed(1),
      gp:     agg.gp,
    };
  }

  return statsMap;
}

// ─── Batch helpers ────────────────────────────────────────────────────────────

export async function getAllPublicData(seasonName = null) {
  const [config, seasons, players] = await Promise.all([
    getConfig(),
    getSeasons(),
    getPlayers(),
  ]);

  const activeSeason = seasonName ?? config.currentSeason;

  const [games, schedule, stats] = await Promise.all([
    getGames(activeSeason),
    getSchedule(activeSeason),
    getStats(activeSeason),
  ]);

  return {
    config,
    seasons,
    currentSeason: activeSeason,
    players,
    games,
    schedule,
    stats,
  };
}

export async function getAllSeasonsStats(seasons) {
  const results = await Promise.all(seasons.map(s => getStats(s)));
  return Object.fromEntries(seasons.map((s, i) => [s, results[i]]));
}

