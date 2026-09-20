import { parseScore } from "@/domain/games/score";

export type GameHigh = {
  key:      string;
  label:    string;
  value:    number;
  gameId:   string;
  opponent: string;
  date:     string;
};

export type PlayerRecord = GameHigh & { playerId: string; home?: boolean };

export type TeamRecord = {
  key:       string;
  label:     string;
  value:     string;
  opponent?: string;
  home?:     boolean;
  date?:     string;
  gameId?:   string;
  from?:     string;
  to?:       string;
};

type StatDef  = { key: string; label: string };
type Dated    = { date: string };
type LogEntry = { gameId: string; opponent: string; date: string } & Record<string, unknown>;
type GameRow  = {
  id: string; date: string; opponent: string; result: string; score: string;
  home?: boolean; boxScore?: Record<string, unknown>[];
};

// What a fan recounts about a game. Efficiency is left out: it already has its
// own card on the home page, and a composite does not read as a personal best
// the way a points total does.
const PERSONAL_STATS: StatDef[] = [
  { key: "pts",  label: "PTS" },
  { key: "reb",  label: "REB" },
  { key: "ast",  label: "AST" },
  { key: "fg3m", label: "3PM" },
];

// The franchise list runs longer: a steals or blocks night nobody has matched
// is a record even where it would not be a headline on one player's page.
const RECORD_STATS: StatDef[] = [
  { key: "pts",  label: "PTS" },
  { key: "reb",  label: "REB" },
  { key: "ast",  label: "AST" },
  { key: "stl",  label: "STL" },
  { key: "blk",  label: "BLK" },
  { key: "fg3m", label: "3PM" },
];

// Highest value per stat, with the row it came from. A tie goes to the most
// recent game, settled on the date rather than on position, so the answer does
// not depend on how the caller sorted the rows. A stat nobody has recorded is
// left out rather than reported as a zero against whichever row came first.
function bestPerStat<T extends Dated>(rows: T[], stats: StatDef[]) {
  const best = new Map<string, { def: StatDef; value: number; row: T }>();

  for (const row of rows) {
    for (const def of stats) {
      const value = Number(Reflect.get(row as object, def.key) ?? 0);
      if (!Number.isFinite(value) || value <= 0) continue;

      const held = best.get(def.key);
      // Dates are YYYY-MM-DD, so comparing them as text is chronological.
      if (held && (value < held.value || (value === held.value && row.date <= held.row.date))) continue;

      best.set(def.key, { def, value, row });
    }
  }

  return stats
    .map(def => best.get(def.key))
    .filter((held): held is { def: StatDef; value: number; row: T } => held !== undefined);
}

export function personalBests(log: LogEntry[] | null | undefined): GameHigh[] {
  return bestPerStat(log ?? [], PERSONAL_STATS).map(({ def, value, row }) => ({
    key: def.key, label: def.label, value,
    gameId: row.gameId, opponent: row.opponent, date: row.date,
  }));
}

// The same question asked of everyone who has ever played: the best single
// game in each stat, whoever had it and whenever it was.
export function playerGameRecords(games: GameRow[] | null | undefined): PlayerRecord[] {
  const rows = (games ?? []).flatMap(game =>
    (game.boxScore ?? [])
      .filter(line => line.played)
      .map(line => ({
        ...line,
        playerId: String(line.pid ?? ""),
        gameId:   game.id,
        opponent: game.opponent,
        date:     game.date,
        home:     game.home,
      })),
  );

  return bestPerStat(rows, RECORD_STATS).map(({ def, value, row }) => ({
    key: def.key, label: def.label, value,
    playerId: row.playerId, gameId: row.gameId, opponent: row.opponent, date: row.date, home: row.home,
  }));
}

// Longest run of wins in the team's history, which is not the streak
// computeRecord reports: that one is the current run, and it ends the moment
// the team loses.
function longestWinStreak(games: GameRow[]) {
  const byDate = [...games].sort((a, b) => a.date.localeCompare(b.date));
  let best = { count: 0, from: "", to: "" };
  let count = 0, from = "";

  for (const game of byDate) {
    if (game.result !== "W") { count = 0; continue; }
    if (count === 0) from = game.date;
    count++;
    if (count > best.count) best = { count, from, to: game.date };
  }

  return best.count > 0 ? best : null;
}

// Best single games the team has played, across every season it has played.
export function teamRecords(games: GameRow[] | null | undefined): TeamRecord[] {
  const scored = (games ?? [])
    .map(game => ({ game, score: parseScore(game.score) }))
    .filter((row): row is { game: GameRow; score: { team: number; opponent: number } } => row.score !== null);

  if (!scored.length) return [];

  // Ties go to the most recent, the same rule the player records follow.
  const bestBy = (rank: (row: typeof scored[number]) => number) =>
    scored.reduce((held, row) => {
      const [a, b] = [rank(row), rank(held)];
      return a > b || (a === b && row.game.date > held.game.date) ? row : held;
    });

  const from = (row: typeof scored[number], key: string, label: string, value: string): TeamRecord => ({
    key, label, value,
    opponent: row.game.opponent, home: row.game.home, date: row.game.date, gameId: row.game.id,
  });

  const mostPoints    = bestBy(r => r.score.team);
  const biggestWin    = bestBy(r => r.score.team - r.score.opponent);
  const fewestAllowed = bestBy(r => -r.score.opponent);
  const streak        = longestWinStreak(scored.map(r => r.game));

  const records: TeamRecord[] = [
    from(mostPoints, "points", "Most Points", String(mostPoints.score.team)),
  ];

  // A team that has never won has no best win, and the widest margin would be
  // its narrowest defeat.
  const margin = biggestWin.score.team - biggestWin.score.opponent;
  if (margin > 0) {
    records.push(from(biggestWin, "margin", "Biggest Win", `+${margin}`));
  }

  records.push(from(fewestAllowed, "defense", "Fewest Allowed", String(fewestAllowed.score.opponent)));

  if (streak) {
    records.push({
      key: "streak", label: "Longest Win Streak",
      value: String(streak.count), from: streak.from, to: streak.to,
    });
  }

  return records;
}
