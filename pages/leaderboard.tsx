import { useState, useMemo } from "react";
import Layout from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui";
import { getAllPublicData, getAllSeasonsStats, getAllPlayerGameLogs } from "@/server/db/repositories";
import { buildAllTimeStatsMap } from "@/domain/stats";
import SeasonSelector from "@/components/ui/SeasonSelector";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { LeaderboardTable, COLS, TOTAL_COLS } from "@/client/leaderboard/leaderboard-table";

type PhaseFilter = "all" | "regular" | "playoffs";
const PLAYOFF_ROUNDS = ["quarterfinal", "semifinal", "final"];

function computeStatsFromLog(log: any[]) {
  const n = log.length;
  if (n === 0) return null;
  // eslint-disable-next-line security/detect-object-injection
  const sum = (key: string) => log.reduce((a: number, r: any) => a + (r[key] || 0), 0);
  const avg = (key: string) => +(sum(key) / n).toFixed(1);
  const fgPct  = sum("fga")  > 0 ? +((sum("fgm")  / sum("fga"))  * 100).toFixed(1) : 0;
  const fg3Pct = sum("fg3a") > 0 ? +((sum("fg3m") / sum("fg3a")) * 100).toFixed(1) : 0;
  const ftPct  = sum("fta")  > 0 ? +((sum("ftm")  / sum("fta"))  * 100).toFixed(1) : 0;
  return {
    ppg: avg("pts"), rpg: avg("reb"), apg: avg("ast"),
    spg: avg("stl"), bpg: avg("blk"), eff: avg("eff"),
    mpg: avg("min"),  fgPct, fg3Pct, ftPct, gp: n,
  };
}

export default function LeaderboardPage({ players, statsMap, seasons, currentSeason, allTimeStatsMap, allPlayerGameLogs }: any) {
  const [sortKey, setSortKey] = useState("ppg");
  const [sortDir, setSortDir] = useState("desc");
  const [activeSeason, setActiveSeason] = useState(currentSeason);
  const [viewMode, setViewMode] = useState<"avg" | "tot">("avg");
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all");

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

  const playersWithStats = useMemo(() => {
    if (phaseFilter === "all") {
      return players
        .map((p: any) => ({ ...p, stats: activeStats[p.id] ?? {} }))
        .filter((p: any) => (p.stats.gp ?? 0) > 0 || activeSeason === "all-time");
    }
    return players
      .map((p: any) => {
        const fullLog = allPlayerGameLogs[p.id] ?? [];
        const filtered = fullLog.filter((entry: any) => {
          const seasonMatch = activeSeason === "all-time" || entry.season === activeSeason;
          const roundMatch  = phaseFilter === "regular"
            ? entry.round === "regular"
            : PLAYOFF_ROUNDS.includes(entry.round);
          return seasonMatch && roundMatch;
        });
        const stats = computeStatsFromLog(filtered) ?? {};
        return { ...p, stats };
      })
      .filter((p: any) => (p.stats.gp ?? 0) > 0);
  }, [players, activeStats, allPlayerGameLogs, phaseFilter, activeSeason]);

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
        onChange={sid => { setActiveSeason(sid); setPhaseFilter("all"); setSortKey("ppg"); setSortDir("desc"); }}
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
          </div>
        }
      />

      <div className="flex items-center gap-1.5 mb-4">
        {(["all", "regular", "playoffs"] as const).map(f => (
          <button
            key={f}
            onClick={() => setPhaseFilter(f)}
            className={`px-[10px] py-[3px] text-[10px] font-black tracking-[0.1em] uppercase rounded-md cursor-pointer border transition-all duration-150 ${
              phaseFilter === f
                ? "border-[#c0392b60] bg-[#8b1a1a25] text-ak-red-text"
                : "border-ak-border bg-transparent text-ak-text-dim"
            }`}
          >
            {f === "all" ? "All Season" : f === "regular" ? "Regular Season" : "Playoffs"}
          </button>
        ))}
      </div>

      <ErrorBoundary label="Leaderboard table failed to load">
        <LeaderboardTable
          sorted={sorted}
          activeCols={activeCols}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </ErrorBoundary>
    </Layout>
  );
}

export async function getStaticProps() {
  const { seasons, currentSeason, players, stats } = await getAllPublicData(null);
  const [allSeasonsStats, allPlayerGameLogs] = await Promise.all([
    getAllSeasonsStats(seasons),
    getAllPlayerGameLogs(),
  ]);
  const allTimeStatsMap = buildAllTimeStatsMap(allSeasonsStats, players);

  return {
    props: { players, statsMap: stats, seasons, currentSeason, allTimeStatsMap, allPlayerGameLogs },
    revalidate: 86400,
  };
}
