import { ZERO_ROW, type ResolvedRow } from "@/domain/import/resolve";
import { byJersey, type BoxScoreRow, type Game, type Player } from "@/client/admin/shared";

export type GameDraft = {
  date:           string;
  opponent:       string;
  home:           boolean;
  result:         "W" | "L" | "T";
  round:          string;
  teamScore:      string;
  opponentScore:  string;
  seasonLeagueId: string;
  sourceUrl:      string;
  youtubeUrl:     string;
  notes:          string;
  boxScore:       ResolvedRow[];
  storedIds:      string[];
};

export function toEditRows(players: Player[], existing: BoxScoreRow[] = []): ResolvedRow[] {
  return [...players].sort(byJersey).map(p => {
    const stored = existing.find(r => r.playerId === p.id);
    return stored
      ? { ...ZERO_ROW, ...stored, playerId: p.id, min: stored.minutes ?? stored.min ?? 0 }
      : { ...ZERO_ROW, playerId: p.id };
  });
}

export function emptyDraft(seasonLeagueId: string, players: Player[]): GameDraft {
  return {
    date: "", opponent: "", home: true, result: "W", round: "regular",
    teamScore: "", opponentScore: "", seasonLeagueId,
    sourceUrl: "", youtubeUrl: "", notes: "",
    boxScore: toEditRows(players), storedIds: [],
  };
}

export function gameToDraft(g: Game, players: Player[]): GameDraft {
  return {
    date:           g.date ?? g.playedOn?.slice(0, 10) ?? "",
    opponent:       g.opponent,
    home:           g.home ?? g.location === "home",
    result:         g.result,
    round:          g.round ?? "regular",
    teamScore:      String(g.teamScore ?? ""),
    opponentScore:  String(g.opponentScore ?? ""),
    seasonLeagueId: g.seasonLeagueId,
    sourceUrl:      g.sourceUrl ?? "",
    youtubeUrl:     g.youtubeUrl ?? "",
    notes:          g.notes ?? "",
    boxScore:       toEditRows(players, g.boxScore),
    storedIds:      (g.boxScore ?? []).map(r => r.playerId),
  };
}

const hasLine = (r: ResolvedRow) => Object.entries(r).some(([k, v]) => k !== "playerId" && v !== 0);

export function validateGameDraft(d: GameDraft): string | null {
  if (!d.opponent.trim()) return "Opponent is required";
  if (!d.date.trim())     return "Date is required";
  if (!d.seasonLeagueId)  return "League is required";
  return null;
}

export function toGameBody(d: GameDraft, gameId: string | null) {
  return {
    gameId:         gameId ?? undefined,
    seasonLeagueId: d.seasonLeagueId,
    opponent:       d.opponent,
    location:       d.home ? "home" : "away",
    teamScore:      Number(d.teamScore) || 0,
    opponentScore:  Number(d.opponentScore) || 0,
    result:         d.result,
    round:          d.round,
    playedOn:       d.date,
    sourceUrl:      d.sourceUrl || null,
    youtubeUrl:     d.youtubeUrl || null,
    // The update stores notes ?? null, so leaving them out would erase them.
    notes:          d.notes || null,
    // The schema caps boxScore at 20, and the update deletes any stored row it is not sent.
    boxScore:       d.boxScore.filter(r => d.storedIds.includes(r.playerId) || hasLine(r)).map(r => ({
      playerId: r.playerId, minutes: r.min,
      pts: r.pts, reb: r.reb, orb: r.orb, drb: r.drb, ast: r.ast, stl: r.stl, blk: r.blk, tov: r.tov, pf: r.pf,
      fg2m: r.fg2m, fg2a: r.fg2a, fg3m: r.fg3m, fg3a: r.fg3a, fgm: r.fg2m + r.fg3m, fga: r.fg2a + r.fg3a,
      ftm: r.ftm, fta: r.fta,
    })),
  };
}
