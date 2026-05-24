import { useState } from "react";
import dynamic from "next/dynamic";
import Layout from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui";
import SeasonSelector from "@/components/ui/SeasonSelector";
import { SeasonAverages } from "@/client/players/SeasonAverages";
import { SeasonHistoryTable } from "@/client/players/SeasonHistoryTable";
import { PlayerHero } from "@/client/players/PlayerHero";
import { getAllPublicData, getAllSeasonsStats, getPlayers } from "@/server/db/repositories";
import { buildAllTimeStatsMap } from "@/domain/stats";

const SkillRadar   = dynamic(() => import("@/client/players/SkillRadar").then(m => ({ default: m.SkillRadar })),     { ssr: false });
const GameLogPanel = dynamic(() => import("@/client/players/GameLogPanel").then(m => ({ default: m.GameLogPanel })), { ssr: false });

const EMPTY_STATS = {
  ppg: 0, rpg: 0, orpg: 0, drpg: 0, apg: 0, spg: 0, bpg: 0,
  tpg: 0, fpg: 0, fgPct: 0, fg2Pct: 0, fg3Pct: 0, ftPct: 0,
  ftmPg: 0, ftaPg: 0, mpg: 0, eff: 0, gp: 0, gameLog: [],
};

export default function PlayerPage({ player, statsMap, allTimeStatsMap, seasons, currentSeason, playerSeasonHistory }: any) {
  const [activeSeason, setActiveSeason] = useState(currentSeason);

  const activeStatsMap = activeSeason === "all-time" ? allTimeStatsMap : statsMap;
  const activeStats    = activeStatsMap[player.id] ?? EMPTY_STATS;
  const gameLog        = activeStats.gameLog ?? [];
  const seasonHistory  = playerSeasonHistory[player.id] ?? {};
  const playerWithHistory = { ...player, seasonHistory };
  const hasStats = activeStats.gp > 0;

  return (
    <Layout title={`${player.name} -- Players`}>
      <SectionHeading title={player.name} />
      <PlayerHero player={player} stats={activeStats} />
      <SeasonSelector
        seasons={seasons}
        currentSeason={activeSeason}
        onChange={setActiveSeason}
        showAllTime={true}
      />
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

export async function getStaticPaths() {
  const players = await getPlayers();
  return {
    paths: players.map(p => ({ params: { slug: p.slug } })),
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }: any) {
  const { seasons, currentSeason, players, stats } = await getAllPublicData(null);
  const player = players.find((p: any) => p.slug === params.slug);
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

  return {
    props: { player, statsMap: stats, allTimeStatsMap, seasons, currentSeason, playerSeasonHistory },
    revalidate: 86400,
  };
}
