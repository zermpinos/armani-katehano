import { byJersey } from "@/client/admin";
import type { Player, SeasonLeague, BoxScoreRow } from "@/client/admin";
import { parseGreekDate, parseMinutes, detectLeagueSlug } from "@/domain/calendar/greek-date";

export type ImportDraft = {
  date: string;
  opponent: string;
  home: boolean;
  result: "W" | "L" | "T";
  teamScore: number;
  opponentScore: number;
  seasonLeagueId: string;
  sourceUrl: string | null;
  boxScore: BoxScoreRow[];
};

export type DraftResult = {
  draft: ImportDraft;
  highlights: Record<string, boolean>;
  warnings: string[];
  offRating: number | null;
  defRating: number | null;
};

export function buildDraft(
  data: Record<string, unknown>,
  players: Player[],
  seasonLeagues: SeasonLeague[],
): DraftResult {
  const { game, teams, url: sourceUrl } = data as {
    game: { homeTeam: string; awayTeam: string; date: string; finalScore: { home: number; away: number }; offRating?: number | null; defRating?: number | null };
    teams: { name: string; players: Record<string, unknown>[] }[];
    url: string;
  };

  const akTeam = teams.find(t =>
    t.name.toUpperCase().includes("ARMANI") ||
    t.name.toUpperCase().includes("KATEHANO")
  );
  if (!akTeam) throw new Error("ARMANI KATEHANO team not found in scraped data");

  const isHome      = game.homeTeam.toUpperCase().includes("ARMANI") ||
                      game.homeTeam.toUpperCase().includes("KATEHANO");
  const akScore     = isHome ? game.finalScore.home  : game.finalScore.away;
  const oppScore    = isHome ? game.finalScore.away  : game.finalScore.home;
  const oppTeamName = isHome ? game.awayTeam         : game.homeTeam;
  const result      = akScore > oppScore ? "W" : akScore < oppScore ? "L" : "T" as const;
  const parsedDate  = parseGreekDate(game.date);
  const date        = parsedDate ? parsedDate.toISOString().slice(0, 10) : "";
  const leagueSlug  = detectLeagueSlug(sourceUrl);

  const matchedSL = seasonLeagues.find(sl => sl.leagueSlug === leagueSlug)
                 ?? seasonLeagues[0];

  const boxScore: BoxScoreRow[] = [...players].sort(byJersey).map(dbPlayer => {
    const scraped = akTeam.players.find((p: Record<string, unknown>) => p["#"] === Number(dbPlayer.number));
    const mins    = scraped ? parseMinutes(scraped.MIN as string) : 0;

    if (!scraped || mins === 0) {
      return {
        playerId: dbPlayer.id, minutes: 0, pts: 0, reb: 0, orb: 0, drb: 0,
        ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
        fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0,
        ftm: 0, fta: 0, eff: 0,
      };
    }

    const fg2m = (scraped["2PTS"] as { made?: number })?.made          ?? 0;
    const fg2a = (scraped["2PTS"] as { attempted?: number })?.attempted ?? 0;
    const fg3m = (scraped["3PTS"] as { made?: number })?.made          ?? 0;
    const fg3a = (scraped["3PTS"] as { attempted?: number })?.attempted ?? 0;

    return {
      playerId: dbPlayer.id,
      min:      mins,
      pts:  scraped.PTS  as number ?? 0,
      reb:  scraped.REB  as number ?? 0,
      orb:  scraped.OREB as number ?? 0,
      drb:  scraped.DREB as number ?? 0,
      ast:  scraped.AST  as number ?? 0,
      stl:  scraped.STL  as number ?? 0,
      blk:  scraped.BLK  as number ?? 0,
      tov:  scraped.TO   as number ?? 0,
      pf:   scraped.PF   as number ?? 0,
      fg2m, fg2a, fg3m, fg3a,
      fgm:  fg2m + fg3m,
      fga:  fg2a + fg3a,
      ftm:  (scraped.FT as { made?: number })?.made          ?? 0,
      fta:  (scraped.FT as { attempted?: number })?.attempted ?? 0,
      eff:  scraped.EF   as number ?? 0,
    };
  });

  const hl: Record<string, boolean> = {};
  akTeam.players.forEach((p: Record<string, unknown>) => {
    if (parseMinutes(p.MIN as string) > 0) {
      const dbPlayer = players.find(pl => Number(pl.number) === p["#"]);
      if (dbPlayer) hl[dbPlayer.id] = true;
    }
  });

  const warns: string[] = [];
  akTeam.players
    .filter((p: Record<string, unknown>) => parseMinutes(p.MIN as string) > 0)
    .forEach((p: Record<string, unknown>) => {
      const fg2m = (p["2PTS"] as { made?: number })?.made ?? 0;
      const fg3m = (p["3PTS"] as { made?: number })?.made ?? 0;
      const ftm  = (p.FT as { made?: number })?.made ?? 0;
      const expPts = fg2m * 2 + fg3m * 3 + ftm;
      if ((p.PTS as number ?? 0) !== expPts)
        warns.push(`#${p["#"]} ${p.Players}: pts=${p.PTS}, expected ${expPts}`);
    });

  return {
    draft: {
      date,
      opponent:       oppTeamName,
      home:           isHome,
      result,
      teamScore:      akScore,
      opponentScore:  oppScore,
      seasonLeagueId: matchedSL?.id ?? "",
      sourceUrl:      sourceUrl ?? null,
      boxScore,
    } satisfies ImportDraft,
    highlights: hl,
    warnings:   warns,
    offRating:  game.offRating ?? null,
    defRating:  game.defRating ?? null,
  };
}
