import { useState, useMemo } from "react";
import Layout from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui";
import SeasonSelector from "@/components/ui/SeasonSelector";
import { getAllGames, getSeasons, getConfig, getAllUpcomingGames } from "@/server/db/repositories";
import { LeagueFilter } from "@/client/games/league-filter";
import { ResultFilter } from "@/client/games/result-filter";
import { CalendarView } from "@/client/games/calendar-view";
import { GamesTable } from "@/client/games/games-table";
import { UpcomingGameModal } from "@/client/games/upcoming-game-modal";
import { phaseLabel } from "@/domain/games/phase";

export default function GamesPage({ allGames, seasons, currentSeason, seasonPhase, upcomingGames }: any) {
  const [selectedSeason, setSelectedSeason] = useState(currentSeason);
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [selectedResult, setSelectedResult] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedUpcomingInList, setSelectedUpcomingInList] = useState<any>(null);

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

  const filterKey = `${selectedSeason}-${selectedLeague}-${selectedResult}`;

  return (
    <Layout title="Games">
      <SectionHeading
        label={
          selectedSeason === currentSeason
            ? `${selectedSeason.replace(/-/g, "–")} · ${phaseLabel(seasonPhase)}`
            : `${selectedSeason.replace(/-/g, "–")} · Season`
        }
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

      {(selectedLeague !== "all" || selectedResult !== "all") && (
        <div className="mb-4">
          <button
            onClick={() => { setSelectedLeague("all"); setSelectedResult("all"); }}
            className="border border-[#c0392b55] bg-[#8b1a1a15] text-ak-red-text text-[10px] font-black rounded-md px-[10px] py-[3px] cursor-pointer"
          >
            ✕ Clear filters
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center p-12 text-ak-text-dim">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-[15px] font-bold">No games recorded yet</div>
        </div>
      ) : viewMode === "calendar" ? (
        <CalendarView
          games={filtered}
          upcomingGames={noFiltersActive ? upcomingGames : []}
        />
      ) : (
        <GamesTable
          key={filterKey}
          items={listItems}
          onUpcomingClick={setSelectedUpcomingInList}
          seasonLeagues={seasonLeagues}
          selectedLeague={selectedLeague}
        />
      )}

      {selectedUpcomingInList && (
        <UpcomingGameModal game={selectedUpcomingInList} onClose={() => setSelectedUpcomingInList(null)} />
      )}
    </Layout>
  );
}

export async function getStaticProps() {
  const [allGames, seasons, config, upcomingGames] = await Promise.all([
    getAllGames(),
    getSeasons(),
    getConfig(),
    getAllUpcomingGames(),
  ]);

  return {
    props: {
      allGames,
      seasons,
      currentSeason: config.currentSeason,
      seasonPhase: config.seasonPhase,
      upcomingGames,
    },
    revalidate: 86400,
  };
}
