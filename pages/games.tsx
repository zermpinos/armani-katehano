import { useState, useMemo } from "react";
import Layout from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui";
import SeasonSelector from "@/components/ui/SeasonSelector";
import { getAllGames, getPlayers, getSeasons, getConfig, getAllUpcomingGames, getAllSeasonsStats } from "@/server/db/repositories";
import { buildAllTimeStatsMap } from "@/domain/stats";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { PlayerDetail } from "@/client/players/PlayerDetail";
import { BoxScore } from "@/client/games/box-score";
import { UpcomingGameModal } from "@/client/games/upcoming-game-modal";
import { LeagueFilter } from "@/client/games/league-filter";
import { ResultFilter } from "@/client/games/result-filter";
import { CalendarView } from "@/client/games/calendar-view";
import { GamesTable } from "@/client/games/games-table";

export default function GamesPage({ allGames, players, seasons, currentSeason, upcomingGames, allTimeStatsMap, playerSeasonHistory }: any) {
  const [selectedSeason, setSelectedSeason] = useState(currentSeason);
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [selectedResult, setSelectedResult] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [loadingBoxScore, setLoadingBoxScore] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedUpcomingInList, setSelectedUpcomingInList] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  const playersWithStats = useMemo(() => players.map((p: any) => ({
    ...p,
    stats:         allTimeStatsMap?.[p.id] ?? { ppg:0, rpg:0, orpg:0, drpg:0, apg:0, spg:0, bpg:0, tpg:0, fpg:0, fgPct:0, fg2Pct:0, fg3Pct:0, ftPct:0, ftmPg:0, ftaPg:0, mpg:0, eff:0, gp:0 },
    gameLog:       allTimeStatsMap?.[p.id]?.gameLog ?? [],
    seasonHistory: playerSeasonHistory?.[p.id] ?? {},
  })), [players, allTimeStatsMap, playerSeasonHistory]);

  const openPlayerById = (id: string) => {
    const match = playersWithStats.find((pp: any) => pp.id === id);
    if (match) setSelectedPlayer(match);
  };

  async function handleGameClick(game: any) {
    setLoadingBoxScore(true);
    setSelected(game);
    try {
      const res = await fetch(`/api/games/${game.id}`);
      const { boxScore } = await res.json();
      setSelected({ ...game, boxScore });
    } finally {
      setLoadingBoxScore(false);
    }
  }

  const seasonLeagues = useMemo(() => {
    const seen = new Map();
    allGames
      .filter((g: any) => g.season === selectedSeason)
      .forEach((g: any) => { if (!seen.has(g.league)) seen.set(g.league, g.leagueName); });
    return [...seen.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allGames, selectedSeason]);

  const noFiltersActive = selectedLeague === "all" && selectedResult === "all";

  const handleSeasonChange = (sid: any) => {
    setSelectedSeason(sid);
    setSelectedLeague("all");
    setSelectedResult("all");
  };

  const filtered = useMemo(() => {
    return allGames
      .filter((g: any) => g.season === selectedSeason)
      .filter((g: any) => selectedLeague === "all" || g.league === selectedLeague)
      .filter((g: any) => selectedResult === "all" || g.result === selectedResult)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allGames, selectedSeason, selectedLeague, selectedResult]);

  const listItems = useMemo(() => {
    const played = filtered.map((g: any) => ({ ...g, _upcoming: false, _sortDate: g.date }));
    if (!noFiltersActive) return played;
    const upcoming = (upcomingGames || []).map((g: any) => ({
      ...g,
      _upcoming: true,
      _sortDate: g.scheduledFor.slice(0, 10),
    }));
    return [...upcoming, ...played].sort((a: any, b: any) =>
      new Date(b._sortDate).getTime() - new Date(a._sortDate).getTime()
    );
  }, [filtered, upcomingGames, noFiltersActive]);

  // Changing filters remounts GamesTable, resetting its internal page to 0
  const filterKey = `${selectedSeason}-${selectedLeague}-${selectedResult}`;

  return (
    <Layout title="Games">
      <SectionHeading
        label={`${selectedSeason.replace(/-/g, "–")} Season`}
        title="Games"
      />

      <SeasonSelector
        seasons={seasons}
        currentSeason={selectedSeason}
        onChange={handleSeasonChange}
        showAllTime={false}
        right={
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim">{filtered.length} GAMES</span>
            <div className="flex gap-0.5 bg-ak-surface2 rounded-lg p-0.5 border border-ak-border">
              {(["list", "calendar"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={mode === "list" ? "List view" : "Calendar view"}
                  className={`px-[9px] py-1 rounded-md border-0 text-[11px] font-black tracking-[0.1em] uppercase cursor-pointer transition-all duration-150 ${
                    viewMode === mode ? "bg-ak-red text-ak-text" : "bg-transparent text-ak-text-dim"
                  }`}
                >
                  {mode === "list" ? "≡" : "▦"}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <LeagueFilter leagues={seasonLeagues} selected={selectedLeague} onChange={setSelectedLeague} />
      <ResultFilter selected={selectedResult} onChange={setSelectedResult} />

      {filtered.length === 0 ? (
        <div className="text-center p-12 text-ak-text-dim">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-[15px] font-bold">No games recorded yet</div>
        </div>
      ) : viewMode === "calendar" ? (
        <CalendarView
          games={filtered}
          upcomingGames={noFiltersActive ? upcomingGames : []}
          onGameClick={handleGameClick}
          loadingBoxScore={loadingBoxScore}
        />
      ) : (
        <GamesTable
          key={filterKey}
          items={listItems}
          loadingBoxScore={loadingBoxScore}
          onGameClick={handleGameClick}
          onUpcomingClick={setSelectedUpcomingInList}
          seasonLeagues={seasonLeagues}
          selectedLeague={selectedLeague}
        />
      )}

      {selected && <BoxScore game={selected} players={players} onClose={() => setSelected(null)} isLoading={loadingBoxScore} onPlayerClick={openPlayerById} />}
      {selectedUpcomingInList && <UpcomingGameModal game={selectedUpcomingInList} onClose={() => setSelectedUpcomingInList(null)} />}
      {selectedPlayer && <PlayerDetail player={selectedPlayer} onClose={() => setSelectedPlayer(null)} activeSeason="all-time" />}
    </Layout>
  );
}

export async function getStaticProps() {
  const [allGames, players, seasons, config, upcomingGames] = await Promise.all([
    getAllGames(),
    getPlayers(),
    getSeasons(),
    getConfig(),
    getAllUpcomingGames(),
  ]);

  const allSeasonsStats = await getAllSeasonsStats(seasons);
  const allTimeStatsMap = buildAllTimeStatsMap(allSeasonsStats, players);

  // Object.create(null) prevents prototype pollution when player.id/sid are from DB data
  const playerSeasonHistory: Record<string, any> = Object.create(null);
  for (const [sid, seasonMap] of Object.entries(allSeasonsStats)) {
    for (const player of players) {
      const s = (seasonMap as any)[player.id];
      if (s && s.gp > 0) {
        // eslint-disable-next-line security/detect-object-injection
        if (!playerSeasonHistory[player.id]) playerSeasonHistory[player.id] = Object.create(null);
        // eslint-disable-next-line security/detect-object-injection
        playerSeasonHistory[player.id][sid] = s;
      }
    }
  }

  return {
    props: { allGames, players, seasons, currentSeason: config.currentSeason, upcomingGames, allTimeStatsMap, playerSeasonHistory },
    revalidate: 86400,
  };
}
