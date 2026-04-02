/**
 * lib/repository.prisma.js
 * New data layer — reads from Neon via Prisma.
 * Exports the same function signatures as lib/repository.js
 * so pages need no changes when we swap.
 */

import prisma from "./prisma.js";
import { calcEff } from "./stats.js";

// ─── Config (hardcoded for now — no longer stored in Redis) ──────────────────

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
    score:        `${g.teamScore}–${g.opponentScore}`,
    league:       g.seasonLeague.league.slug,
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

// ─── Schedule ────────────────────────────────────────────────────────────────

export async function getSchedule(seasonName) {
  // Schedule not yet implemented in new schema — return empty array
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

  // If multiple leagues, merge by player.
  // Rate stats use weighted average by gp.
  // Percentage stats are recomputed from summed raw totals for accuracy.
  const merged = {};

  for (const agg of aggregates) {
    const pid = agg.playerId;
    if (!merged[pid]) {
      merged[pid] = { ...agg };
      continue;
    }

    const prev    = merged[pid];
    const totalGp = prev.gp + agg.gp;
    const wavg    = (a, b) =>
      totalGp > 0 ? +((a * prev.gp + b * agg.gp) / totalGp).toFixed(2) : 0;

    merged[pid] = {
      ...prev,
      gp:         totalGp,
      // Rate stats — weighted average
      ptsAvg:     wavg(prev.ptsAvg,     agg.ptsAvg),
      rebAvg:     wavg(prev.rebAvg,     agg.rebAvg),
      orbAvg:     wavg(prev.orbAvg,     agg.orbAvg),
      drbAvg:     wavg(prev.drbAvg,     agg.drbAvg),
      astAvg:     wavg(prev.astAvg,     agg.astAvg),
      stlAvg:     wavg(prev.stlAvg,     agg.stlAvg),
      blkAvg:     wavg(prev.blkAvg,     agg.blkAvg),
      toAvg:      wavg(prev.toAvg,      agg.toAvg),
      pfAvg:      wavg(prev.pfAvg,      agg.pfAvg),
      minutesAvg: wavg(prev.minutesAvg, agg.minutesAvg),
      effAvg:     wavg(prev.effAvg ?? 0, agg.effAvg ?? 0),
      // Shot totals — summed so percentages can be recomputed accurately
      fgmTotal:   (prev.fgmTotal  ?? 0) + (agg.fgmTotal  ?? 0),
      fgaTotal:   (prev.fgaTotal  ?? 0) + (agg.fgaTotal  ?? 0),
      fg2mTotal:  (prev.fg2mTotal ?? 0) + (agg.fg2mTotal ?? 0),
      fg2aTotal:  (prev.fg2aTotal ?? 0) + (agg.fg2aTotal ?? 0),
      fg3mTotal:  (prev.fg3mTotal ?? 0) + (agg.fg3mTotal ?? 0),
      fg3aTotal:  (prev.fg3aTotal ?? 0) + (agg.fg3aTotal ?? 0),
      ftmTotal:   (prev.ftmTotal  ?? 0) + (agg.ftmTotal  ?? 0),
      ftaTotal:   (prev.ftaTotal  ?? 0) + (agg.ftaTotal  ?? 0),
      ptsTotal:   prev.ptsTotal + agg.ptsTotal,
      rebTotal:   prev.rebTotal + agg.rebTotal,
      astTotal:   prev.astTotal + agg.astTotal,
    };
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
      // Percentages computed from raw totals — accurate across leagues
      fgPct:  pct(agg.fgmTotal  ?? 0, fgaTotal),
      fg2Pct: pct(agg.fg2mTotal ?? 0, fg2aTotal),
      fg3Pct: pct(agg.fg3mTotal ?? 0, fg3aTotal),
      ftPct:  ftaTotal > 0 ? pct(agg.ftmTotal ?? 0, ftaTotal) : null,
      // tsPct stays as weighted avg — requires pts/fga/fta totals together
      tsPct:  +agg.tsPct.toFixed(1),
      eff:    +((agg.effAvg ?? 0).toFixed(1)),
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
