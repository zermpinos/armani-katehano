export function computeStatsFromLog(log: any[]) {
  const n = log.length;
  if (n === 0) return null;

  // eslint-disable-next-line security/detect-object-injection
  const sum = (key: string) => log.reduce((a: number, r: any) => a + (r[key] || 0), 0);
  const avg = (key: string) => +(sum(key) / n).toFixed(1);

  const fgmTotal  = sum("fgm");
  const fgaTotal  = sum("fga");
  const fg2mTotal = sum("fg2m");
  const fg2aTotal = sum("fg2a");
  const fg3mTotal = sum("fg3m");
  const fg3aTotal = sum("fg3a");
  const ftmTotal  = sum("ftm");
  const ftaTotal  = sum("fta");

  const pct = (m: number, a: number) => a > 0 ? +((m / a) * 100).toFixed(1) : 0;

  return {
    ppg:  avg("pts"),
    rpg:  avg("reb"),
    orpg: avg("orb"),
    drpg: avg("drb"),
    apg:  avg("ast"),
    spg:  avg("stl"),
    bpg:  avg("blk"),
    tpg:  avg("tov"),
    fpg:  avg("pf"),
    eff:  avg("eff"),
    mpg:  avg("min"),
    fgPct:  pct(fgmTotal,  fgaTotal),
    fg2Pct: pct(fg2mTotal, fg2aTotal),
    fg3Pct: pct(fg3mTotal, fg3aTotal),
    ftPct:  pct(ftmTotal,  ftaTotal),
    fgm:  fgmTotal,
    fga:  fgaTotal,
    fg2m: fg2mTotal,
    fg2a: fg2aTotal,
    fg3m: fg3mTotal,
    fg3a: fg3aTotal,
    ftm:  ftmTotal,
    fta:  ftaTotal,
    ftmPg: +(ftmTotal / n).toFixed(1),
    ftaPg: +(ftaTotal / n).toFixed(1),
    pts_total: sum("pts"),
    reb_total: sum("reb"),
    ast_total: sum("ast"),
    stl_total: sum("stl"),
    gp: n,
  };
}
