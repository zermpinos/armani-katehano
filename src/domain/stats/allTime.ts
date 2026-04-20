export function buildAllTimeStatsMap(allSeasonsStats: any, players: any[]) {
  const statsMap: Record<string, any> = {};

  for (const player of players) {
    const entries = Object.values(allSeasonsStats)
      .map((seasonStats: any) => seasonStats[player.id])
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

    const totalGp = entries.reduce((s, e) => s + e.gp, 0);
    // eslint-disable-next-line security/detect-object-injection
    const wavg = (key: string) => {
      // eslint-disable-next-line security/detect-object-injection
      const weighted = entries.reduce((s: number, e: any) => s + (e[key] || 0) * e.gp, 0);
      return +(weighted / totalGp).toFixed(1);
    };

    // Sum raw shot totals across seasons for statistically correct percentages
    // eslint-disable-next-line security/detect-object-injection
    const sumRaw = (key: string) => entries.reduce((s: number, e: any) => s + (e[key] ?? 0), 0);
    const fgm  = sumRaw("fgm");
    const fga  = sumRaw("fga");
    const fg2m = sumRaw("fg2m");
    const fg2a = sumRaw("fg2a");
    const fg3m = sumRaw("fg3m");
    const fg3a = sumRaw("fg3a");
    const ftm  = sumRaw("ftm");
    const fta  = sumRaw("fta");
    const pct  = (m: number, a: number) => a > 0 ? +((m / a) * 100).toFixed(1) : 0;

    const allGameLogs = entries
      .flatMap(e => e.gameLog || [])
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    statsMap[player.id] = {
      ppg:    totalGp > 0 ? +(sumRaw("pts_total") / totalGp).toFixed(1) : 0,
      rpg:    totalGp > 0 ? +(sumRaw("reb_total") / totalGp).toFixed(1) : 0,
      orpg:   wavg("orpg"),
      drpg:   wavg("drpg"),
      apg:    totalGp > 0 ? +(sumRaw("ast_total") / totalGp).toFixed(1) : 0,
      spg:    totalGp > 0 ? +(sumRaw("stl_total") / totalGp).toFixed(1) : 0,
      bpg:    wavg("bpg"),
      tpg:    wavg("tpg"),
      fpg:    wavg("fpg"),
      // Percentages computed from summed raw totals -- statistically correct
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
      // Season totals -- summed across seasons
      pts_total: sumRaw("pts_total"),
      reb_total: sumRaw("reb_total"),
      ast_total: sumRaw("ast_total"),
      stl_total: sumRaw("stl_total"),
      gameLog: allGameLogs,
    };
  }

  return statsMap;
}
