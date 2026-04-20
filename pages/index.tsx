import { useState } from "react";
import Layout from "../components/Layout";
import { StatTile, SectionHeading } from "../components/ui";
import { getAllPublicData, getUpcomingGamesWithAnnouncements } from "../lib/data";
import { computeRecord } from "../lib/stats";
import { fmt } from "../lib/utils";
import ErrorBoundary from "../components/ErrorBoundary";
import { PlayerDetail } from "../components/PlayerDetail";
import { ConfirmToast } from "@/client/home/confirm-toast";
import { SubscribeForm } from "@/client/home/subscribe-form";
import { ScoringTrendModal } from "@/client/home/scoring-trend-modal";
import { UpcomingGamesSection } from "@/client/home/upcoming-games-section";
import { ScoringTrendChart } from "@/client/home/scoring-trend-chart";
import { RecentResultsCard } from "@/client/home/recent-results-card";
import { TopScorersChart } from "@/client/home/top-scorers-chart";
import { EfficiencyLeaderCard } from "@/client/home/efficiency-leader-card";

export default function HomePage({ players, games, stats, upcomingGames, currentSeason }: any) {
  const [trendRange, setTrendRange] = useState(10);
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [openRosterId, setOpenRosterId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const toggleRoster = (id: string) => setOpenRosterId(prev => prev === id ? null : id);

  const playersWithStats = players.map((p: any) => ({
    ...p,
    stats: stats[p.id] ?? { ppg: 0, rpg: 0, apg: 0, fgPct: 0, eff: 0, mpg: 0, gp: 0 },
  }));

  const openPlayerById = (id: string) => {
    const match = playersWithStats.find((pp: any) => pp.id === id);
    if (match) setSelectedPlayer(match);
  };

  const record = computeRecord(games);

  const winPct = record.wins + record.losses > 0
    ? (record.wins / (record.wins + record.losses) * 100).toFixed(1)
    : "0.0";

  const activePlayers = playersWithStats.filter((p: any) => (p.stats.gp ?? 0) > 0);
  const mvp = activePlayers.length
    ? activePlayers.reduce((b: any, p: any) => p.stats.eff > b.stats.eff ? p : b, activePlayers[0])
    : null;

  const generateTrendData = (rangeGames: number) => {
    return [...games]
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, rangeGames)
      .reverse()
      .map((g: any, i: number) => {
        const parts = (g.score || "0-0").split(/[--]/);
        return {
          idx:    i,
          game:   g.home ? `vs ${g.opponent || `G${i + 1}`}` : `@ ${g.opponent || `G${i + 1}`}`,
          pts:    parseInt(parts[0]) || 0,
          opp:    parseInt(parts[1]) || 0,
          result: g.result,
        };
      });
  };

  const topPlayers = [...playersWithStats]
    .filter((p: any) => p.stats.ppg > 0)
    .sort((a: any, b: any) => b.stats.ppg - a.stats.ppg)
    .slice(0, 5);

  const topScorers = topPlayers.map((p: any) => ({ name: fmt(p.name), ppg: p.stats.ppg }));

  const trend = generateTrendData(10);
  const extendedTrend = generateTrendData(trendRange);

  const recentGames = [...games]
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const hasData = games.length > 0 && activePlayers.length > 0;

  return (
    <Layout title="Armani Katehano">
      <ConfirmToast />

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden py-10 px-8 border border-ak-border bg-ak-surface mb-6">
        <div className="absolute inset-0 opacity-[0.18] ak-hero-texture" />
        <div className="absolute top-0 right-0 w-[280px] h-[280px] rounded-full bg-[#8b1a1a18] translate-x-[35%] -translate-y-[35%]" />
        <div className="relative">
          <div className="text-[11px] font-black tracking-[0.18em] uppercase text-ak-red-text mb-2">2025-26 · Regular Season</div>
          <h1 className="text-[clamp(36px,6vw,64px)] font-black leading-none tracking-[-0.02em] uppercase text-ak-text">
            Armani<br /><span className="text-ak-red-bright">Katehano</span>
          </h1>
          <p className="mt-3 text-[13px] font-semibold text-ak-text-sub">
            {record.wins}-{record.losses}
            {record.streak.count > 0 && <> · <span className="text-ak-red-text">{record.streak.count}-game {record.streak.type === "W" ? "win" : "loss"} streak</span></>}
            {" "}· <span className="text-ak-red-text">{winPct}%</span> win rate
          </p>
        </div>
      </div>

      {/* Record tiles */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 mb-6">
        <StatTile label="Record"  value={`${record.wins}-${record.losses}`} sub={`${winPct}% win rate`} />
        <StatTile label="Streak"  value={record.streak.count > 0 ? `${record.streak.count}${record.streak.type}` : "--"} sub="current streak" highlight={record.streak.type === "W" && record.streak.count > 0} />
        <StatTile label="PPG"     value={record.ppg    || "--"} sub="points per game" />
        <StatTile label="OPP PPG" value={record.oppPpg || "--"} sub="allowed per game" />
      </div>

      <UpcomingGamesSection
        upcomingGames={upcomingGames}
        openRosterId={openRosterId}
        onToggleRoster={toggleRoster}
        onPlayerClick={openPlayerById}
        showAllUpcoming={showAllUpcoming}
        onShowMore={() => setShowAllUpcoming(true)}
      />

      <SubscribeForm />

      <ErrorBoundary label="Stats failed to load">
        {hasData && (
          <div className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
              <ScoringTrendChart trend={trend} onShowMore={() => setShowTrendModal(true)} />
              <RecentResultsCard recentGames={recentGames} />
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
              <TopScorersChart topScorers={topScorers} />
              <EfficiencyLeaderCard mvp={mvp} />
            </div>
          </div>
        )}
      </ErrorBoundary>

      {!hasData && (
        <div className="text-center py-12 text-ak-text-dim">
          <div className="text-[40px] mb-3">🏀</div>
          <div className="text-[15px] font-bold">No data yet</div>
          <div className="text-[13px] mt-1">Add games via the admin panel to see stats here.</div>
        </div>
      )}

      <ScoringTrendModal
        show={showTrendModal}
        onClose={() => setShowTrendModal(false)}
        extendedTrend={extendedTrend}
        trendRange={trendRange}
        setTrendRange={setTrendRange}
        totalGames={games.length}
      />

      {selectedPlayer && <PlayerDetail player={selectedPlayer} onClose={() => setSelectedPlayer(null)} activeSeason={currentSeason ?? null} />}
    </Layout>
  );
}

export async function getStaticProps() {
  const [{ players, games, stats, currentSeason }, upcomingGames] = await Promise.all([
    getAllPublicData(),
    getUpcomingGamesWithAnnouncements(),
  ]);
  return { props: { players, games, stats, upcomingGames, currentSeason }, revalidate: 86400 };
}
