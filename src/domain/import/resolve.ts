import { parseGreekDate, parseMinutes, detectLeagueSlug } from "@/domain/calendar/greek-date";
import { isUsTeam } from "./identity";

export interface RosterPlayer {
  id: string;
  number: number | string;
}

export interface SeasonLeagueRef {
  id: string;
  leagueSlug: string;
  seasonStart: string | null;
  seasonEnd: string | null;
}

export interface ResolvedRow {
  playerId: string;
  min: number;
  pts: number; reb: number; orb: number; drb: number;
  ast: number; stl: number; blk: number; tov: number; pf: number;
  fgm: number; fga: number; fg2m: number; fg2a: number; fg3m: number; fg3a: number;
  ftm: number; fta: number;
  eff: number;
}

export interface ImportDraft {
  date: string;
  opponent: string;
  home: boolean;
  result: "W" | "L" | "T";
  teamScore: number;
  opponentScore: number;
  seasonLeagueId: string;
  sourceUrl: string | null;
  boxScore: ResolvedRow[];
}

export interface ResolveResult {
  draft: ImportDraft;
  highlights: Record<string, boolean>;
  unresolved: string[];
}

type ScrapedPlayer = Record<string, unknown>;

const ZERO_ROW = {
  min: 0, pts: 0, reb: 0, orb: 0, drb: 0,
  ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
  fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0,
  ftm: 0, fta: 0, eff: 0,
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function shot(cell: unknown): { made: number; attempted: number } {
  const c = cell as { made?: number; attempted?: number } | undefined;
  return { made: num(c?.made), attempted: num(c?.attempted) };
}

// A season with no end date is open, so it covers any date.
function coversDate(sl: SeasonLeagueRef, playedOn: Date | null): boolean {
  if (!playedOn || !sl.seasonEnd) return true;
  return new Date(sl.seasonEnd) >= playedOn;
}

function bySeasonStartDesc(a: SeasonLeagueRef, b: SeasonLeagueRef): number {
  return (b.seasonStart ?? "").localeCompare(a.seasonStart ?? "");
}

// /men/ URLs are shared by Rookie, BC6 and BC8, so the slug alone cannot pick a
// league. Anything the URL cannot settle becomes an unresolved entry for the
// admin rather than a silent default.
function resolveLeague(
  sourceUrl: string | null,
  playedOn: Date | null,
  seasonLeagues: SeasonLeagueRef[],
  unresolved: string[],
): string {
  const slug = detectLeagueSlug(sourceUrl);
  if (!slug) {
    unresolved.push("No league could be detected from the source URL. Pick one under Game info.");
    return "";
  }

  const eligible = seasonLeagues.filter(sl => coversDate(sl, playedOn));

  if (slug === "men") {
    const candidates = eligible.filter(sl => !sl.leagueSlug.includes("winter"));
    if (candidates.length === 1) return candidates[0].id;
    unresolved.push(
      candidates.length === 0
        ? "No active league covers this game date. Pick one under Game info, or configure the season."
        : `Several active leagues match this URL (${candidates.map(c => c.leagueSlug).join(", ")}). Pick one under Game info.`,
    );
    return "";
  }

  const matches = eligible.filter(sl => sl.leagueSlug === slug).sort(bySeasonStartDesc);
  if (matches.length) return matches[0].id;

  unresolved.push(`No active season found for league "${slug}". Pick one under Game info.`);
  return "";
}

export function resolve(
  raw: Record<string, unknown>,
  roster: RosterPlayer[],
  seasonLeagues: SeasonLeagueRef[],
): ResolveResult {
  const { game, teams, url: sourceUrl } = raw as {
    game: { homeTeam: string; awayTeam: string; date: string; finalScore: { home: number; away: number } };
    teams: { name: string; players: ScrapedPlayer[] }[];
    url: string;
  };

  const akTeam = teams.find(t => isUsTeam(t.name));
  if (!akTeam) {
    const found = teams.map(t => `"${t.name}"`).join(", ");
    throw new Error(`Our team was not found in the scraped data. Teams in payload: ${found}`);
  }

  const isHome      = isUsTeam(game.homeTeam);
  const akScore     = isHome ? game.finalScore.home : game.finalScore.away;
  const oppScore    = isHome ? game.finalScore.away : game.finalScore.home;
  const oppTeamName = isHome ? game.awayTeam        : game.homeTeam;
  const result      = akScore > oppScore ? "W" : akScore < oppScore ? "L" : "T";
  const playedOn    = parseGreekDate(game.date);

  const unresolved: string[] = [];
  const seasonLeagueId = resolveLeague(sourceUrl ?? null, playedOn, seasonLeagues, unresolved);

  const played = akTeam.players.filter(p => parseMinutes(p.MIN as string) > 0);

  // A scraped jersey with no roster match would be dropped from the box score
  // entirely, so it blocks the save instead.
  for (const p of played) {
    if (!roster.some(r => Number(r.number) === p["#"]))
      unresolved.push(`#${p["#"]} ${p.Players} played but is not on the roster; add them before importing.`);
  }

  const boxScore: ResolvedRow[] = [...roster]
    .sort((a, b) => Number(a.number) - Number(b.number))
    .map(rosterPlayer => {
      const scraped = akTeam.players.find(p => p["#"] === Number(rosterPlayer.number));
      const min     = scraped ? parseMinutes(scraped.MIN as string) : 0;
      if (!scraped || min === 0) return { playerId: rosterPlayer.id, ...ZERO_ROW };

      const fg2 = shot(scraped["2PTS"]);
      const fg3 = shot(scraped["3PTS"]);
      const ft  = shot(scraped.FT);

      return {
        playerId: rosterPlayer.id,
        min,
        pts:  num(scraped.PTS),
        reb:  num(scraped.REB),
        orb:  num(scraped.OREB),
        drb:  num(scraped.DREB),
        ast:  num(scraped.AST),
        stl:  num(scraped.STL),
        blk:  num(scraped.BLK),
        tov:  num(scraped.TO),
        pf:   num(scraped.PF),
        fg2m: fg2.made, fg2a: fg2.attempted,
        fg3m: fg3.made, fg3a: fg3.attempted,
        fgm:  fg2.made + fg3.made,
        fga:  fg2.attempted + fg3.attempted,
        ftm:  ft.made, fta: ft.attempted,
        eff:  num(scraped.EF),
      };
    });

  const highlights: Record<string, boolean> = {};
  for (const p of played) {
    const rosterPlayer = roster.find(r => Number(r.number) === p["#"]);
    if (rosterPlayer) highlights[rosterPlayer.id] = true;
  }

  return {
    draft: {
      date:           playedOn ? playedOn.toISOString().slice(0, 10) : "",
      opponent:       oppTeamName,
      home:           isHome,
      result,
      teamScore:      akScore,
      opponentScore:  oppScore,
      seasonLeagueId,
      sourceUrl:      sourceUrl ?? null,
      boxScore,
    },
    highlights,
    unresolved,
  };
}

export type FieldDiff = { path: string; from: unknown; to: unknown };

// Field-level diff between the resolver's draft and the admin-edited draft, so
// the audit log records exactly what a human changed before saving.
export function diffDraft(resolved: ImportDraft, final: ImportDraft): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const topKeys = [
    "date", "opponent", "home", "result",
    "teamScore", "opponentScore", "seasonLeagueId", "sourceUrl",
  ] as const;
  for (const k of topKeys) {
    const from = Reflect.get(resolved, k), to = Reflect.get(final, k);
    if (from !== to) diffs.push({ path: k, from, to });
  }
  const before = new Map(resolved.boxScore.map(r => [r.playerId, r as unknown as Record<string, unknown>]));
  for (const row of final.boxScore as unknown as Record<string, unknown>[]) {
    const prev = before.get(row.playerId as string);
    if (!prev) { diffs.push({ path: `box.${row.playerId}`, from: null, to: "added" }); continue; }
    for (const key of Object.keys(row)) {
      if (key === "playerId") continue;
      const from = Reflect.get(prev, key), to = Reflect.get(row, key);
      if (from !== to) diffs.push({ path: `box.${row.playerId}.${key}`, from, to });
    }
  }
  return diffs;
}
