export function mergeAggregates(prev: any, agg: any) {
  const totalGp = prev.gp + agg.gp;
  const wavg = (a: number, b: number) =>
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
    stlTotal:   (prev.stlTotal  ?? 0) + (agg.stlTotal  ?? 0),
  };
}

export function aggregatesToStatsMap(aggregates: any[]) {
  // Object.create(null) prevents prototype pollution when pid is from DB data
  const merged: Record<string, any> = Object.create(null);
  for (const agg of aggregates) {
    const pid = agg.playerId;
    // eslint-disable-next-line security/detect-object-injection
    if (!merged[pid]) {
      // eslint-disable-next-line security/detect-object-injection
      merged[pid] = { ...agg };
    } else {
      // eslint-disable-next-line security/detect-object-injection
      merged[pid] = mergeAggregates(merged[pid], agg);
    }
  }

  const pct = (m: number, a: number) => a > 0 ? +((m / a) * 100).toFixed(1) : 0;

  // Object.create(null) prevents prototype pollution when pid is from DB data
  const statsMap: Record<string, any> = Object.create(null);
  for (const [pid, agg] of Object.entries(merged)) {
    const fgaTotal  = agg.fgaTotal  ?? 0;
    const fg2aTotal = agg.fg2aTotal ?? 0;
    const fg3aTotal = agg.fg3aTotal ?? 0;
    const ftaTotal  = agg.ftaTotal  ?? 0;
    const ptsTotal  = agg.ptsTotal  ?? 0;

    // TS% computed from summed raw totals -- statistically correct across leagues.
    const tsDenom = 2 * (fgaTotal + 0.44 * ftaTotal);
    const tsPct   = tsDenom > 0 ? +(ptsTotal / tsDenom * 100).toFixed(1) : 0;

    // eslint-disable-next-line security/detect-object-injection
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
      // Percentages from raw totals -- accurate across leagues
      fgPct:  pct(agg.fgmTotal  ?? 0, fgaTotal),
      fg2Pct: pct(agg.fg2mTotal ?? 0, fg2aTotal),
      fg3Pct: pct(agg.fg3mTotal ?? 0, fg3aTotal),
      ftPct:  ftaTotal > 0 ? pct(agg.ftmTotal ?? 0, ftaTotal) : null,
      ftmPg:  agg.gp > 0 ? +((agg.ftmTotal ?? 0) / agg.gp).toFixed(1) : 0,
      ftaPg:  agg.gp > 0 ? +((agg.ftaTotal ?? 0) / agg.gp).toFixed(1) : 0,
      tsPct,
      eff:    +((agg.effAvg ?? 0).toFixed(1)),
      gp:     agg.gp,
      // Raw shot totals -- carried so buildAllTimeStatsMap can sum across seasons
      fgm:  agg.fgmTotal  ?? 0,
      fga:  agg.fgaTotal  ?? 0,
      fg2m: agg.fg2mTotal ?? 0,
      fg2a: agg.fg2aTotal ?? 0,
      fg3m: agg.fg3mTotal ?? 0,
      fg3a: agg.fg3aTotal ?? 0,
      ftm:  agg.ftmTotal  ?? 0,
      fta:  agg.ftaTotal  ?? 0,
      // Season totals stored directly in DB
      pts_total: agg.ptsTotal ?? 0,
      reb_total: agg.rebTotal ?? 0,
      ast_total: agg.astTotal ?? 0,
      stl_total: agg.stlTotal ?? 0,
    };
  }

  return statsMap;
}

export function buildStatsMap(players: any[], games: any[]) {
  const statsMap: Record<string, any> = {};

  for (const player of players) {
    const rows = games
      .filter(g => g.boxScore)
      .flatMap((g: any) => g.boxScore.filter((r: any) => r.pid === player.id && r.min > 0));

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
    // eslint-disable-next-line security/detect-object-injection
    const sum = (f: string) => rows.reduce((acc: number, r: any) => acc + (r[f] || 0), 0);
    const avg = (f: string) => +(sum(f) / n).toFixed(1);
    const pct = (m: string, a: string) => {
      const t = sum(a);
      return t > 0 ? +(sum(m) / t * 100).toFixed(1) : 0;
    };

    const gameLog = games
      .filter((g: any) => g.boxScore)
      .map((g: any) => {
        const r = g.boxScore.find((r: any) => r.pid === player.id && r.min > 0);
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
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
      stl_total: sum("stl"),
      gameLog,
    };
  }

  return statsMap;
}

export function computeTeamAverages(games: any[]) {
  const gp = games.length;
  if (gp === 0) {
    return { rpg:0, apg:0, spg:0, bpg:0, tpg:0, fgPct:0, fg3Pct:0, ftPct:0, atRatio:0 };
  }

  const rows = games.flatMap((g: any) => g.boxScore || []).filter((r: any) => r.min > 0);
  // eslint-disable-next-line security/detect-object-injection
  const sum  = (key: string) => rows.reduce((a: number, r: any) => a + (r[key] || 0), 0);
  const pct  = (m: string, a: string) => {
    const t = sum(a);
    return t > 0 ? +(sum(m) / t * 100).toFixed(1) : 0;
  };

  const astTotal = sum("ast");
  const tovTotal = sum("tov");

  return {
    rpg:     +(sum("reb") / gp).toFixed(1),
    apg:     +(sum("ast") / gp).toFixed(1),
    spg:     +(sum("stl") / gp).toFixed(1),
    bpg:     +(sum("blk") / gp).toFixed(1),
    tpg:     +(sum("tov") / gp).toFixed(1),
    fgPct:   pct("fgm",  "fga"),
    fg3Pct:  pct("fg3m", "fg3a"),
    ftPct:   pct("ftm",  "fta"),
    atRatio: tovTotal > 0 ? +(astTotal / tovTotal).toFixed(2) : 0,
  };
}

// Backward-compat wrapper -- new code should call buildStatsMap directly.
export function recalcPlayerAverages(players: any[], games: any[]) {
  const statsMap = buildStatsMap(players, games);
  return players.map(player => ({
    ...player,
    stats:   statsMap[player.id] ?? {},
    gameLog: statsMap[player.id]?.gameLog ?? [],
  }));
}
