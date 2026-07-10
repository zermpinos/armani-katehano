import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Layout from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui";
import SeasonSelector from "@/components/ui/SeasonSelector";
import ArchivedBanner from "@/components/ui/ArchivedBanner";
import { SeasonAverages } from "@/client/players/SeasonAverages";
import { SeasonHistoryTable } from "@/client/players/SeasonHistoryTable";
import { PlayerHero } from "@/client/players/PlayerHero";
import { getAllPublicData, getAllSeasonsStats, getPlayerGameLog } from "@/server/db/repositories";
import { buildAllTimeStatsMap, computeStatsFromLog } from "@/domain/stats";

const SkillRadar   = dynamic(() => import("@/client/players/SkillRadar").then(m => ({ default: m.SkillRadar })),     { ssr: false });
const GameLogPanel = dynamic(() => import("@/client/players/GameLogPanel").then(m => ({ default: m.GameLogPanel })), { ssr: false });

type PhaseFilter = "all" | "regular" | "playoffs";
const PLAYOFF_ROUNDS = ["quarterfinal", "semifinal", "final"];

const EMPTY_STATS = {
  ppg: 0, rpg: 0, orpg: 0, drpg: 0, apg: 0, spg: 0, bpg: 0,
  tpg: 0, fpg: 0, fgPct: 0, fg2Pct: 0, fg3Pct: 0, ftPct: 0,
  ftmPg: 0, ftaPg: 0, mpg: 0, eff: 0, gp: 0,
};

export default function PlayerPage({ player, statsMap, allTimeStatsMap, seasons, currentSeason, playerSeasonHistory, allGameLog, archivedSeasonNames }: any) {
  const [activeSeason, setActiveSeason] = useState(currentSeason);
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all");

  const seasonHistory  = playerSeasonHistory[player.id] ?? {};

  // For past seasons, seasonHistory already holds the DB aggregate (same source as leaderboard/players).
  // statsMap only carries currentSeason; allTimeStatsMap covers "all-time".
  const activeStatsMap = activeSeason === "all-time"
    ? allTimeStatsMap
    : activeSeason !== currentSeason && seasonHistory[activeSeason]
      ? { [player.id]: seasonHistory[activeSeason] }
      : statsMap;

  const baseGameLog = activeSeason === "all-time"
    ? allGameLog
    : allGameLog.filter((g: any) => g.season === activeSeason);

  const gameLog = useMemo(() => {
    if (phaseFilter === "all") return baseGameLog;
    if (phaseFilter === "regular") return baseGameLog.filter((g: any) => g.round === "regular");
    return baseGameLog.filter((g: any) => PLAYOFF_ROUNDS.includes(g.round));
  }, [baseGameLog, phaseFilter]);

  const activeStats = useMemo(() => {
    if (phaseFilter !== "all") return computeStatsFromLog(gameLog) ?? EMPTY_STATS;
    return activeStatsMap[player.id] ?? EMPTY_STATS;
  }, [phaseFilter, gameLog, activeStatsMap, player.id]);

  const handleSeasonChange = (sid: string) => {
    setActiveSeason(sid);
    setPhaseFilter("all");
  };

  const playerWithHistory = { ...player, seasonHistory };
  const hasStats = activeStats.gp > 0;

  return (
    <Layout title={`${player.name} - Players`}>
      <SectionHeading title={player.name} />
      <PlayerHero player={player} stats={activeStats} />
      <SeasonSelector
        seasons={seasons}
        currentSeason={activeSeason}
        onChange={handleSeasonChange}
        showAllTime={true}
      />
      <ArchivedBanner archived={archivedSeasonNames.includes(activeSeason)} seasonName={activeSeason} />
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
      {hasStats ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-start-2 sm:col-span-2 sm:row-start-1">
            <SeasonAverages s={activeStats} />
          </div>
          <div className="sm:col-start-2 sm:col-span-2 sm:row-start-2">
            <SeasonHistoryTable player={playerWithHistory} activeSeason={activeSeason} />
          </div>
          <div className="sm:col-start-1 sm:row-start-1 sm:row-span-2">
            <SkillRadar s={activeStats} />
          </div>
          <div className="sm:col-span-3 sm:row-start-3">
            {gameLog.length > 0 && <GameLogPanel gameLog={gameLog} />}
          </div>
        </div>
      ) : (
        <>
          <SeasonHistoryTable player={playerWithHistory} activeSeason={activeSeason} />
          <p className="text-center text-ak-text-dim text-[13px] py-6">
            No stats recorded yet for this season.
          </p>
        </>
      )}
    </Layout>
  );
}

const SLUG_RE = /^[a-z0-9-]+$/;

export async function getStaticPaths() {
  try {
    const { players } = await getAllPublicData();
    const active = players.filter((p: any) => p.isActive);
    return {
      paths: active.map((p: any) => ({ params: { slug: p.slug } })),
      fallback: "blocking" as const,
    };
  } catch (err) {
    console.error("[getStaticPaths] /players/[slug] DB read failed", err);
    return { paths: [], fallback: "blocking" as const };
  }
}

export async function getStaticProps({ params }: any) {
  const { slug } = params;
  if (!SLUG_RE.test(slug)) return { notFound: true };

  const { seasons, currentSeason, players, stats, archivedSeasonNames } = await getAllPublicData(null);
  const player = players.find((p: any) => p.slug === slug);
  if (!player) return { notFound: true };

  const allSeasonsStats = await getAllSeasonsStats(seasons);
  const allTimeStatsMap = buildAllTimeStatsMap(allSeasonsStats, players);

  const playerSeasonHistory: Record<string, any> = {};
  for (const [sid, seasonMap] of Object.entries(allSeasonsStats)) {
    const s = (seasonMap as any)[player.id];
    if (s && s.gp > 0) {
      if (!playerSeasonHistory[player.id]) playerSeasonHistory[player.id] = {};
      Object.assign(playerSeasonHistory[player.id] as Record<string, unknown>, { [sid]: s });
    }
  }

  const allGameLog = await getPlayerGameLog(player.id);

  return {
    props: { player, statsMap: stats, allTimeStatsMap, seasons, currentSeason, playerSeasonHistory, allGameLog, archivedSeasonNames },
    revalidate: 14400,
  };
}
