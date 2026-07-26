import { parseGreekDate } from "@/domain/calendar/greek-date";
import { classifyScrapedGame } from "./classify";

export interface GateFailure {
  check: string;
  detail: string;
}

export interface GateResult {
  ok: boolean;
  failures: GateFailure[];
}

type Shot = { made?: number } | null | undefined;
type ScrapedPlayer = Record<string, unknown>;
type ScrapedTeam = { name: string; players: ScrapedPlayer[] };

// Every column resolve() reads. The scrape schema is passthrough, so a column
// the source stops emitting arrives as undefined and zero-fills without error.
export const REQUIRED_COLUMNS = [
  "#", "Players", "MIN", "PTS", "REB", "OREB", "DREB",
  "AST", "STL", "BLK", "TO", "PF", "2PTS", "3PTS", "FT", "EF",
];

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function made(cell: unknown): number {
  return num((cell as Shot)?.made);
}

function norm(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

// Asserts the scrape against itself, before any admin edit, so a check can
// never be satisfied by editing the value it checks. Classifies its own input
// rather than taking a state, which a caller could pass from a different scrape.
export function verify(raw: Record<string, unknown>): GateResult {
  const failures: GateFailure[] = [];
  const fail = (check: string, detail: string) => failures.push({ check, detail });

  const { game, teams } = raw as {
    game?: {
      homeTeam?: string;
      awayTeam?: string;
      date?: string | null;
      finalScore?: { home: number | null; away: number | null };
    };
    teams?: ScrapedTeam[];
  };

  const { state, reason } = classifyScrapedGame(raw);
  if (state !== "final")
    fail("state", `Game state is "${state}": ${reason}.`);

  if (!game?.date || !parseGreekDate(game.date))
    fail("date", `Game date "${game?.date ?? ""}" is missing or unparseable.`);

  const sides = [
    { label: "home", name: game?.homeTeam, score: game?.finalScore?.home },
    { label: "away", name: game?.awayTeam, score: game?.finalScore?.away },
  ];

  for (const side of sides) {
    const team = (teams ?? []).find(t => norm(t.name) === norm(side.name));
    if (!team) {
      fail("teams", `No box score section matches the ${side.label} team "${side.name ?? ""}".`);
      continue;
    }

    // A fixture the organisers published without a result renders as four zero
    // quarters and an empty box score. That is internally consistent with a 0-0
    // final and passes every check below by giving them nothing to check, so
    // without this the gate calls an unplayed game clean.
    if (!team.players?.length) {
      fail("empty", `${team.name || side.label}: box score has no players.`);
      continue;
    }

    for (const p of team.players) {
      const missing = REQUIRED_COLUMNS.filter(c => !(c in p));
      if (missing.length) {
        fail("columns", `${team.name}: box score is missing column(s) ${missing.join(", ")}.`);
        break;
      }
    }

    const summed = team.players.reduce((acc, p) => acc + num(p.PTS), 0);
    if (summed !== num(side.score))
      fail("score", `${team.name}: per-player points sum to ${summed}, final score says ${num(side.score)}.`);

    for (const p of team.players) {
      const expected = made(p["2PTS"]) * 2 + made(p["3PTS"]) * 3 + made(p.FT);
      if (num(p.PTS) !== expected)
        fail("player-points", `${team.name} #${p["#"]} ${p.Players}: PTS ${num(p.PTS)}, shots total ${expected}.`);
    }
  }

  return { ok: failures.length === 0, failures };
}
