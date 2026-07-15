export function computeRecord(games: any[], leagueFilter: string | null = null) {
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

    const parts = (g.score || "").split("-");
    if (parts.length === 2) {
      totalPts    += parseInt(parts[0], 10) || 0;
      totalOppPts += parseInt(parts[1], 10) || 0;
    }
  }

  // Streak: sort newest->oldest, walk until result changes
  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
