/**
 * lib/stats.js
 * Pure stat computation functions -- no Redis I/O, no side effects.
 * All functions take plain data in, return plain data out.
 *
 * Imported by:
 *   - lib/data.js          (re-exported for backward compat)
 *   - pages/api/admin/data.js
 *   - future: lib/services/gameService.js
 */

// ─── computeRecord ────────────────────────────────────────────────────────────

/**
 * Computes the full record object from the games array.
 * Pass leagueFilter = "rookie" | "bc6" | "wintercup" to scope to one league,
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

    // Parse score "72-58" -- handles en-dash or regular hyphen
    const parts = (g.score || "").split(/[-\-]/);
    if (parts.length === 2) {
      totalPts    += parseInt(parts[0], 10) || 0;
      totalOppPts += parseInt(parts[1], 10) || 0;
    }
  }

  // Streak: sort newest->oldest, walk until result changes
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

// ─── recalcPlayerAverages ─────────────────────────────────────────────────────

/**
 * Recalculates season averages for all players from the games' box scores.
 * Called by the admin API after adding or editing a game.
 *
 * Returns a new players array -- does not mutate the input.
 */
export function recalcPlayerAverages(players, games) {
  return players.map(player => {
    // All box score rows where this player had minutes
    const rows = games
      .filter(g => g.boxScore)
      .flatMap(g => g.boxScore.filter(r => r.pid === player.id && r.min > 0));

    // Player has not played in any game -- return unchanged with zeroed stats
    if (rows.length === 0) {
      return {
        ...player,
        stats: {
          ppg:0, rpg:0, orpg:0, drpg:0, apg:0, spg:0, bpg:0,
          tpg:0, fpg:0, fgPct:0, fg2Pct:0, fg3Pct:0, ftPct:0, mpg:0, eff:0,
        },
        gameLog: [],
      };
    }

    const n   = rows.length;
    const sum = f => rows.reduce((acc, r) => acc + (r[f] || 0), 0);
    const avg = f => +(sum(f) / n).toFixed(1);
    const pct = (m, a) => {
      const t = sum(a);
      return t > 0 ? +(sum(m) / t * 100).toFixed(1) : 0;
    };

    // Build game log -- all games sorted oldest->newest for chart display
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
          season:   g.season   || "",
          pts: r.pts || 0,
          reb: r.reb || 0,
          ast: r.ast || 0,
          stl: r.stl || 0,
          blk: r.blk || 0,
          eff: r.eff || 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      ...player,
      stats: {
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
        mpg:    avg("min"),
        eff:    avg("eff"),
      },
      gameLog,
    };
  });
}

// ─── calcEff ──────────────────────────────────────────────────────────────────

/**
 * Computes per-game efficiency from a box score row.
 * Used as a fallback when the score sheet doesn't provide a RAN value.
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
