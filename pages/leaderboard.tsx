import { useState } from "react";
import Layout from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui";
import { getAllPublicData, getAllSeasonsStats } from "@/server/db/repositories";
import { buildAllTimeStatsMap } from "@/domain/stats";
import SeasonSelector from "@/components/ui/SeasonSelector";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { PlayerDetail } from "@/client/players/PlayerDetail";
import { LeaderboardTable, COLS, TOTAL_COLS } from "@/client/leaderboard/leaderboard-table";

export default function LeaderboardPage({ players, statsMap, seasons, currentSeason, allTimeStatsMap, playerSeasonHistory }: any) {
  const [sortKey, setSortKey] = useState("ppg");
  const [sortDir, setSortDir] = useState("desc");
  const [activeSeason, setActiveSeason] = useState(currentSeason);
  const [viewMode, setViewMode] = useState<"avg" | "tot">("avg");
  const [selected, setSelected] = useState<any>(null);

  const activeCols = viewMode === "avg" ? COLS : TOTAL_COLS;
  const activeStats = activeSeason === "all-time" ? allTimeStatsMap : statsMap;

  const handleSort = (key: string) => {
    if (key === sortKey) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleViewMode = (mode: "avg" | "tot") => {
    setViewMode(mode);
    setSortKey(mode === "avg" ? "ppg" : "pts_total");
    setSortDir("desc");
  };

  const playersWithStats = players
    .map((p: any) => ({
      ...p,
      stats:         activeStats[p.id] ?? {},
      gameLog:       activeStats[p.id]?.gameLog ?? [],
      seasonHistory: playerSeasonHistory?.[p.id] ?? {},
    }))
    .filter((p: any) => (p.stats.gp ?? 0) > 0 || activeSeason === "all-time");

  const sorted = [...playersWithStats].sort((a, b) => {
    const av = Reflect.get(a.stats as object, sortKey) ?? 0;
    const bv = Reflect.get(b.stats as object, sortKey) ?? 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  return (
    <Layout title="Leaderboard">
      <SectionHeading label="2025-26 Season" title="Leaderboard" />

      <SeasonSelector
        seasons={seasons}
        currentSeason={activeSeason}
        onChange={sid => { setActiveSeason(sid); }}
        showAllTime={true}
        right={
          <div className="flex items-center gap-1.5">
            {(["avg", "tot"] as const).map(m => (
              <button
                key={m}
                onClick={() => handleViewMode(m)}
                className={`px-[10px] py-[3px] text-[10px] font-black tracking-[0.1em] rounded-md cursor-pointer border transition-all duration-150 ${
                  viewMode === m
                    ? "border-[#c0392b60] bg-[#8b1a1a25] text-ak-red-text"
                    : "border-ak-border bg-transparent text-ak-text-dim"
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
            <span className="text-[11px] text-ak-text-dim ml-1">Click column to sort</span>
          </div>
        }
      />

      <div className="text-xs text-ak-text-dim mb-4">
        Sorted by: <span className="text-ak-red-text font-black">{activeCols.find(c => c.key === sortKey)?.title}</span>
        <span className="text-ak-text-dim"> {sortDir === "desc" ? "↓" : "↑"}</span>
      </div>

      <ErrorBoundary label="Leaderboard table failed to load">
        <LeaderboardTable
          sorted={sorted}
          activeCols={activeCols}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onSelect={setSelected}
        />
      </ErrorBoundary>

      {selected && <PlayerDetail player={selected} onClose={() => setSelected(null)} activeSeason={activeSeason} />}
    </Layout>
  );
}

export async function getStaticProps() {
  const { seasons, currentSeason, players, stats } = await getAllPublicData(null);
  const allSeasonsStats = await getAllSeasonsStats(seasons);
  const allTimeStatsMap = buildAllTimeStatsMap(allSeasonsStats, players);

  const playerSeasonHistory: Record<string, any> = {};
  for (const [sid, seasonMap] of Object.entries(allSeasonsStats)) {
    for (const player of players) {
      const s = (seasonMap as any)[player.id];
      if (s && s.gp > 0) {
        if (!Reflect.has(playerSeasonHistory, player.id)) Reflect.set(playerSeasonHistory, player.id, {});
        Reflect.set(Reflect.get(playerSeasonHistory as object, player.id), sid, s);
      }
    }
  }

  return { props: { players, statsMap: stats, seasons, currentSeason, allTimeStatsMap, playerSeasonHistory }, revalidate: 86400 };
}
