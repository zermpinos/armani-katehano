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
  mvp: PlayerRef[];
  scorer: PlayerRef[];
  rebounds: PlayerRef[];
  assists: PlayerRef[];
  shooting: PlayerRef[];
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

function pickTopN(
  rows: readonly Collapsed[],
  keyValue: (c: Collapsed) => number,
  eligible: (c: Collapsed) => boolean,
  n: number
): PlayerRef[] {
  const pool = rows.filter(eligible);
  const sorted = [...pool].sort((a, b) => {
    const av = keyValue(a);
    const bv = keyValue(b);
    if (bv !== av) return bv - av;
    return a.playerName.localeCompare(b.playerName);
  });
  return sorted.slice(0, n).map((c) => toRef(c, keyValue(c)));
}

export function computeAwards(
  rows: readonly AggregateInput[],
  totalGamesInSeason: number
): Awards | null {
  if (!rows.length) return null;
  const collapsed = collapseByPlayer(rows);

  const gpFloor = Math.min(5, totalGamesInSeason);
  const fgaFloor = Math.min(20, totalGamesInSeason);

  const mvp = pickTopN(
    collapsed,
    (c) => (c.gp > 0 ? c.effAvgWeighted / c.gp : 0),
    (c) => c.gp >= gpFloor,
    3
  );
  const scorer   = pickTopN(collapsed, (c) => c.ptsTotal, () => true, 3);
  const rebounds = pickTopN(collapsed, (c) => c.rebTotal, () => true, 3);
  const assists  = pickTopN(collapsed, (c) => c.astTotal, () => true, 3);
  const shooting = pickTopN(
    collapsed,
    (c) => (c.fgaTotal > 0 ? c.tsPctWeighted / c.fgaTotal : 0),
    (c) => c.fgaTotal >= fgaFloor && fgaFloor > 0,
    3
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
    case "shooting": return `${value.toFixed(1)}%`;
    case "scorer":
    case "rebounds":
    case "assists":  return Math.round(value).toString();
  }
}
