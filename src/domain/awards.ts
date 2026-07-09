export type AggregateInput = {
  playerId: string;
  playerName: string;
  playerSlug: string;
  playerNumber: number;
  gp: number;
  ptsTotal: number;
  rebTotal: number;
  astTotal: number;
  effAvg: number;
  tsPct: number;
  fgaTotal: number;
};

export type PlayerRef = {
  playerId: string;
  playerName: string;
  playerSlug: string;
  playerNumber: number;
  value: number;
};

export type Awards = {
  mvp: PlayerRef | null;
  scorer: PlayerRef | null;
  rebounds: PlayerRef | null;
  assists: PlayerRef | null;
  shooting: PlayerRef | null;
};

type Collapsed = {
  playerId: string;
  playerName: string;
  playerSlug: string;
  playerNumber: number;
  gp: number;
  ptsTotal: number;
  rebTotal: number;
  astTotal: number;
  effAvgWeighted: number;
  tsPctWeighted: number;
  fgaTotal: number;
};

// ponytail: multi-league collapse weights averages by gp, a pragmatic default.
// Upgrade to per-league normalization if a wrong winner is reported for a season
// that mixes wildly different competition levels.
function collapseByPlayer(rows: readonly AggregateInput[]): Collapsed[] {
  const map = new Map<string, Collapsed>();
  for (const r of rows) {
    const existing = map.get(r.playerId);
    if (!existing) {
      map.set(r.playerId, {
        playerId: r.playerId,
        playerName: r.playerName,
        playerSlug: r.playerSlug,
        playerNumber: r.playerNumber,
        gp: r.gp,
        ptsTotal: r.ptsTotal,
        rebTotal: r.rebTotal,
        astTotal: r.astTotal,
        effAvgWeighted: r.effAvg * r.gp,
        tsPctWeighted: r.tsPct * r.fgaTotal,
        fgaTotal: r.fgaTotal,
      });
    } else {
      existing.gp += r.gp;
      existing.ptsTotal += r.ptsTotal;
      existing.rebTotal += r.rebTotal;
      existing.astTotal += r.astTotal;
      existing.effAvgWeighted += r.effAvg * r.gp;
      existing.tsPctWeighted += r.tsPct * r.fgaTotal;
      existing.fgaTotal += r.fgaTotal;
    }
  }
  return [...map.values()];
}

function toRef(c: Collapsed, value: number): PlayerRef {
  return {
    playerId: c.playerId,
    playerName: c.playerName,
    playerSlug: c.playerSlug,
    playerNumber: c.playerNumber,
    value,
  };
}

function pickMax(
  rows: readonly Collapsed[],
  keyValue: (c: Collapsed) => number,
  eligible: (c: Collapsed) => boolean
): PlayerRef | null {
  const pool = rows.filter(eligible);
  if (!pool.length) return null;
  let best = pool[0];
  for (const r of pool.slice(1)) {
    const rv = keyValue(r);
    const bv = keyValue(best);
    if (rv > bv || (rv === bv && r.playerName.localeCompare(best.playerName) < 0)) {
      best = r;
    }
  }
  return toRef(best, keyValue(best));
}

export function computeAwards(
  rows: readonly AggregateInput[],
  totalGamesInSeason: number
): Awards | null {
  if (!rows.length) return null;
  const collapsed = collapseByPlayer(rows);

  const gpFloor = Math.min(5, totalGamesInSeason);
  const fgaFloor = Math.min(20, totalGamesInSeason);

  const mvp = pickMax(
    collapsed,
    (c) => (c.gp > 0 ? c.effAvgWeighted / c.gp : 0),
    (c) => c.gp >= gpFloor
  );
  const scorer = pickMax(collapsed, (c) => c.ptsTotal, () => true);
  const rebounds = pickMax(collapsed, (c) => c.rebTotal, () => true);
  const assists = pickMax(collapsed, (c) => c.astTotal, () => true);
  const shooting = pickMax(
    collapsed,
    (c) => (c.fgaTotal > 0 ? c.tsPctWeighted / c.fgaTotal : 0),
    (c) => c.fgaTotal >= fgaFloor && fgaFloor > 0
  );

  return { mvp, scorer, rebounds, assists, shooting };
}

export type AwardCategory = "mvp" | "scorer" | "rebounds" | "assists" | "shooting";

export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const [first, ...rest] = parts;
  return `${first[0]}. ${rest.join(" ")}`;
}

export function formatAwardValue(category: AwardCategory, value: number): string {
  switch (category) {
    case "mvp":      return value.toFixed(1);
    case "shooting": return `${(value * 100).toFixed(1)}%`;
    case "scorer":
    case "rebounds":
    case "assists":  return Math.round(value).toString();
  }
}
