export type GameHigh = {
  key:      string;
  label:    string;
  value:    number;
  gameId:   string;
  opponent: string;
  date:     string;
};

type LogEntry = { gameId: string; opponent: string; date: string } & Record<string, unknown>;

// What a fan recounts about a game. Efficiency is left out: it already has its
// own card on the home page, and a composite does not read as a personal best
// the way a points total does.
const HIGH_STATS = [
  { key: "pts",  label: "PTS" },
  { key: "reb",  label: "REB" },
  { key: "ast",  label: "AST" },
  { key: "fg3m", label: "3PM" },
];

// Best single game per stat, in that order. A tie goes to the most recent game,
// settled on the date rather than on position, so the answer does not depend on
// how the caller sorted the log. A stat the player has never recorded is left
// out rather than reported as a zero against whichever game came first.
export function personalBests(log: LogEntry[] | null | undefined): GameHigh[] {
  const best = new Map<string, GameHigh>();

  for (const game of log ?? []) {
    for (const { key, label } of HIGH_STATS) {
      const value = Number(Reflect.get(game, key) ?? 0);
      if (!Number.isFinite(value) || value <= 0) continue;

      const held = best.get(key);
      // Dates are YYYY-MM-DD, so comparing them as text is chronological.
      if (held && (value < held.value || (value === held.value && game.date <= held.date))) continue;

      best.set(key, { key, label, value, gameId: game.gameId, opponent: game.opponent, date: game.date });
    }
  }

  return HIGH_STATS.map(s => best.get(s.key)).filter((h): h is GameHigh => h !== undefined);
}
