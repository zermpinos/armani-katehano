/**
 * lib/stats.js
 * Pure stat computation functions — no Redis I/O, no side effects.
 * All functions take plain data in, return plain data out.
 *
 * Imported by:
 *   - lib/data.js          (re-exported for backward compat)
 *   - pages/api/admin/data.js
 */

// ─── mergeAggregates ─────────────────────────────────────────────────────────
// Merges two PlayerSeasonAggregate rows into one combined row.
// Rate stats use weighted average by gp; shot totals are summed.
// Used by lib/repository.prisma.js and pages/api/admin/data.js so the
// logic lives in exactly one place.

export function mergeAggregates(prev, agg) {
  const totalGp = prev.gp + agg.gp;
  const wavg = (a, b) =>
    totalGp > 0 ? +((a * prev.gp + b * agg.gp) / totalGp).toFixed(2) : 0;

  return {
    ...prev,
    gp:         totalGp,
    ptsAvg:     wavg(prev.ptsAvg,      agg.ptsAvg),
    rebAvg:     wavg(prev.rebAvg,      agg.rebAvg),
    orbAvg:     wavg(prev.orbAvg,      agg.orbAvg),
    drbAvg:     wavg(prev.drbAvg,      agg.drbAvg),
    astAvg:     wavg(prev.astAvg,      agg.astAvg),
    stlAvg:     wavg(prev.stlAvg,      agg.stlAvg),
    blkAvg:     wavg(prev.blkAvg,      agg.blkAvg),
    toAvg:      wavg(prev.toAvg,       agg.toAvg),
    pfAvg:      wavg(prev.pfAvg,       agg.pfAvg),
    minutesAvg: wavg(prev.minutesAvg,  agg.minutesAvg),
    effAvg:     wavg(prev.effAvg  ?? 0, agg.effAvg  ?? 0),
    tsPct:      wavg(prev.tsPct   ?? 0, agg.tsPct   ?? 0),
    fgmTotal:   (prev.fgmTotal  ?? 0) + (agg.fgmTotal  ?? 0),
    fgaTotal:   (prev.fgaTotal  ?? 0) + (agg.fgaTotal  ?? 0),
    fg2mTotal:  (prev.fg2mTotal ?? 0) + (agg.fg2mTotal ?? 0),
    fg2aTotal:  (prev.fg2aTotal ?? 0) + (agg.fg2aTotal ?? 0),
    fg3mTotal:  (prev.fg3mTotal ?? 0) + (agg.fg3mTotal ?? 0),
    fg3aTotal:  (prev.fg3aTotal ?? 0) + (agg.fg3aTotal ?? 0),
    ftmTotal:   (prev.ftmTotal  ?? 0) + (agg.ftmTotal  ?? 0),
    ftaTotal:   (prev.ftaTotal  ?? 0) + (agg.ftaTotal  ?? 0),
    ptsTotal:   (prev.ptsTotal  ?? 0) + (agg.ptsTotal  ?? 0),
    rebTotal:   (prev.rebTotal  ?? 0) + (agg.rebTotal  ?? 0),
    astTotal:   (prev.astTotal  ?? 0) + (agg.astTotal  ?? 0),
  };
}

// ─── computeRecord ────────────────────────────────────────────────────────────

/**
 * Computes the full record object from a games array.
 * Pass leagueFilter = "rookie" | "bc6" | "wintercup" | "" to scope to one league,
 * or omit / pass null for all games combined.
 *
 * Returns:
 *   { wins, losses, homeWins, homeLosses, awayWins, awayLosses,
 *     streak: { type, count }, ppg, oppPpg, gp }
 */
export function computeRecord(games, leagueFilter = null) {
  const filtered = leagueFilter
    ? games.filter(g => (g.league || "") === leagueFilter)
    : games;

  const gp = filtered.length;
  if (gp === 0) {
    return {
      wins: 0, losses: 0,
      homeWins: 0, homeLosses: 0,
      awayWins: 0, awayLosses: 0,
      streak: { type: "W", count: 0 },
      ppg: 0, oppPpg: 0, gp: 0,
    };
  }

  let wins = 0, losses = 0;
  let homeWins = 0, homeLosses = 0;
  let awayWins = 0, awayLosses = 0;
  let totalPts = 0, totalOppPts = 0;

  for (const g of filtered) {
    const isW = g.result === "W";
    if (isW) wins++; else losses++;
    if (g.home) { if (isW) homeWins++; else homeLosses++; }
    else        { if (isW) awayWins++; else awayLosses++; }

    // Handles en-dash or regular hyphen
    const parts = (g.score || "").split(/[–\-]/);
    if (parts.length === 2) {
      totalPts    += parseInt(parts[0], 10) || 0;
      totalOppPts += parseInt(parts[1], 10) || 0;
    }
  }

  // Streak: sort newest→oldest, walk until result changes
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
  const streakType = sorted[0].result;
  let streakCount = 0;
  for (const g of sorted) {
    if (g.result === streakType) streakCount++;
    else break;
  }

  return {
    wins, losses,
    homeWins, homeLosses,
    awayWins, awayLosses,
    streak: { type: streakType, count: streakCount },
    ppg:    +(totalPts    / gp).toFixed(1),
    oppPpg: +(totalOppPts / gp).toFixed(1),
    gp,
  };
}

// ─── buildStatsMap ────────────────────────────────────────────────────────────

/**
 * Builds a season stats map from players (bio) and games (with boxScores).
 *
 * Returns: { [pid]: SeasonStats }
 *
 * SeasonStats shape:
 *   { ppg, rpg, orpg, drpg, apg, spg, bpg, tpg, fpg,
 *     fgPct, fg2Pct, fg3Pct, ftPct, mpg, eff,
 *     gp,       — games played this season
 *     gameLog   — [ { gameId, date, opponent, league, pts, reb, ast, stl, blk, eff } ]
 *   }
 *
 * Players who did not play in any game get a zeroed entry so the leaderboard
 * can still render them consistently.
 */
export function buildStatsMap(players, games) {
  const statsMap = {};

  for (const player of players) {
    const rows = games
      .filter(g => g.boxScore)
      .flatMap(g => g.boxScore.filter(r => r.pid === player.id && r.min > 0));

    if (rows.length === 0) {
      statsMap[player.id] = {
        ppg:0, rpg:0, orpg:0, drpg:0, apg:0, spg:0, bpg:0,
        tpg:0, fpg:0, fgPct:0, fg2Pct:0, fg3Pct:0, ftPct:0, ftmPg:0, ftaPg:0, mpg:0, eff:0,
        gp: 0,
        gameLog: [],
      };
      continue;
    }

    const n   = rows.length;
    const sum = f => rows.reduce((acc, r) => acc + (r[f] || 0), 0);
    const avg = f => +(sum(f) / n).toFixed(1);
    const pct = (m, a) => {
      const t = sum(a);
      return t > 0 ? +(sum(m) / t * 100).toFixed(1) : 0;
    };

    const gameLog = games
      .filter(g => g.boxScore)
      .map(g => {
        const r = g.boxScore.find(r => r.pid === player.id && r.min > 0);
        if (!r) return null;
        return {
          gameId:   g.id,
          date:     g.date     || "",
          opponent: g.opponent || "",
          league:   g.league   || "",
          pts: r.pts || 0,
          reb: r.reb || 0,
          ast: r.ast || 0,
          stl: r.stl || 0,
          blk: r.blk || 0,
          eff: r.eff || 0,
          min: r.min || 0,
          ftm: r.ftm || 0,
          fta: r.fta || 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    statsMap[player.id] = {
      ppg:    avg("pts"),
      rpg:    avg("reb"),
      orpg:   avg("orb"),
      drpg:   avg("drb"),
      apg:    avg("ast"),
      spg:    avg("stl"),
      bpg:    avg("blk"),
      tpg:    avg("tov"),
      fpg:    avg("pf"),
      fgPct:  pct("fgm",  "fga"),
      fg2Pct: pct("fg2m", "fg2a"),
      fg3Pct: pct("fg3m", "fg3a"),
      ftPct:  pct("ftm",  "fta"),
      ftmPg:  avg("ftm"),
      ftaPg:  avg("fta"),
      mpg:    avg("min"),
      eff:    avg("eff"),
      gp:     n,
      gameLog,
    };
  }

  return statsMap;
}

// ─── buildAllTimeStatsMap ─────────────────────────────────────────────────────

/**
 * Aggregates stats across multiple seasons into a single all-time stats map.
 *
 * allSeasonsStats: { [seasonId]: { [pid]: SeasonStats } }
 * players: PlayerBio[]  (needed for the full player id list)
 *
 * Returns: { [pid]: SeasonStats }  — weighted averages across all seasons
 */
export function buildAllTimeStatsMap(allSeasonsStats, players) {
  const statsMap = {};

  for (const player of players) {
    const entries = Object.values(allSeasonsStats)
      .map(seasonStats => seasonStats[player.id])
      .filter(s => s && s.gp > 0);

    if (entries.length === 0) {
      statsMap[player.id] = {
        ppg:0, rpg:0, orpg:0, drpg:0, apg:0, spg:0, bpg:0,
        tpg:0, fpg:0, fgPct:0, fg2Pct:0, fg3Pct:0, ftPct:0, ftmPg:0, ftaPg:0, mpg:0, eff:0,
        gp: 0,
        gameLog: [],
      };
      continue;
    }

    // Weight each season's averages by games played
    const totalGp = entries.reduce((s, e) => s + e.gp, 0);
    const wavg = key => {
      const weighted = entries.reduce((s, e) => s + (e[key] || 0) * e.gp, 0);
      return +(weighted / totalGp).toFixed(1);
    };

    // Sum raw shot totals across seasons for statistically correct percentages
    const sumRaw = key => entries.reduce((s, e) => s + (e[key] ?? 0), 0);
    const fgm  = sumRaw("fgm");
    const fga  = sumRaw("fga");
    const fg2m = sumRaw("fg2m");
    const fg2a = sumRaw("fg2a");
    const fg3m = sumRaw("fg3m");
    const fg3a = sumRaw("fg3a");
    const ftm  = sumRaw("ftm");
    const fta  = sumRaw("fta");
    const pct  = (m, a) => a > 0 ? +((m / a) * 100).toFixed(1) : 0;

    const allGameLogs = entries
      .flatMap(e => e.gameLog || [])
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    statsMap[player.id] = {
      ppg:    wavg("ppg"),
      rpg:    wavg("rpg"),
      orpg:   wavg("orpg"),
      drpg:   wavg("drpg"),
      apg:    wavg("apg"),
      spg:    wavg("spg"),
      bpg:    wavg("bpg"),
      tpg:    wavg("tpg"),
      fpg:    wavg("fpg"),
      // Percentages computed from summed raw totals — statistically correct
      fgPct:  pct(fgm,  fga),
      fg2Pct: pct(fg2m, fg2a),
      fg3Pct: pct(fg3m, fg3a),
      ftPct:  fta > 0 ? pct(ftm, fta) : null,
      ftmPg:  totalGp > 0 ? +(ftm / totalGp).toFixed(1) : 0,
      ftaPg:  totalGp > 0 ? +(fta / totalGp).toFixed(1) : 0,
      mpg:    wavg("mpg"),
      eff:    wavg("eff"),
      gp:     totalGp,
      // Carry raw totals forward so further aggregation stays accurate
      fgm, fga, fg2m, fg2a, fg3m, fg3a, ftm, fta,
      gameLog: allGameLogs,
    };
  }

  return statsMap;
}

// ─── recalcPlayerAverages ─────────────────────────────────────────────────────
// Kept for backward compat — wraps buildStatsMap, returns updated players array.
// New code should call buildStatsMap directly.

export function recalcPlayerAverages(players, games) {
  const statsMap = buildStatsMap(players, games);
  return players.map(player => ({
    ...player,
    stats:   statsMap[player.id] ?? {},
    gameLog: statsMap[player.id]?.gameLog ?? [],
  }));
}

// ─── calcEff ──────────────────────────────────────────────────────────────────

/**
 * Computes per-game efficiency from a box score row.
 * Fallback when the score sheet's RAN value is missing.
 */
export function calcEff({
  pts=0, reb=0, ast=0, stl=0, blk=0,
  tov=0, fgm=0, fga=0, ftm=0, fta=0,
} = {}) {
  return Math.round(
    pts + reb + ast + stl + blk
    - (fga - fgm)
    - (fta - ftm)
    - tov
  );
}
