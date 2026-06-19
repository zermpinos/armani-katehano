import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Layout from "@/components/ui/Layout";
import { SectionHeading, StatTile } from "@/components/ui";
import { getAllPublicData } from "@/server/db/repositories";
import { computeRecord } from "@/domain/games/score";
import { computeTeamAverages } from "@/domain/stats";
import { fmt } from "@/domain/players/format";
import SeasonSelector from "@/components/ui/SeasonSelector";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { RecordBreakdown } from "@/client/team-stats/record-breakdown";
import { ShootingSplits } from "@/client/team-stats/shooting-splits";

// MinutesChart pulls in recharts; loading it dynamically keeps recharts out
// of this page's chunk and any chunk Next.js prefetches for a <Link> here.
const MinutesChart = dynamic(
  () => import("@/client/team-stats/minutes-chart").then(m => ({ default: m.MinutesChart })),
  { ssr: false }
);

const TAB_BASE = "px-[10px] py-[3px] text-[10px] font-black tracking-[0.1em] uppercase rounded-md cursor-pointer border transition-all duration-150";
const TAB_ACTIVE   = "border-[#c0392b60] bg-[#8b1a1a25] text-ak-red-text";
const TAB_INACTIVE = "border-ak-border bg-transparent text-ak-text-dim hover:text-ak-text";

type PhaseFilter = "all" | "regular" | "playoffs";
const PLAYOFF_ROUNDS = ["quarterfinal", "semifinal", "final"];

export default function TeamPage({ players, games, seasons, currentSeason }: any) {
  const [league, setLeague] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all");

  const handleSeasonChange = (sid: any) => {
    window.location.href = sid === "all-time" ? "/team-stats" : `/team-stats?season=${sid}`;
  };

  const leagueTabs = useMemo(() => {
    const seen = new Map();
    games.forEach((g: any) => {
      if (g.league && !seen.has(g.league)) seen.set(g.league, g.leagueName || g.league);
    });
    return [
      { key: "all", label: "All Games" },
      ...[...seen.entries()]
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [games]);

  const phaseFilteredGames = useMemo(() => {
    if (phaseFilter === "all") return games;
    if (phaseFilter === "regular") return games.filter((g: any) => g.round === "regular");
    return games.filter((g: any) => PLAYOFF_ROUNDS.includes(g.round));
  }, [games, phaseFilter]);

  const filteredGames = useMemo(
    () => league === "all" ? phaseFilteredGames : phaseFilteredGames.filter((g: any) => g.league === league),
    [phaseFilteredGames, league],
  );

  const gp = filteredGames.length;

  const rec = useMemo(() => computeRecord(filteredGames), [filteredGames]);
  const teamAvg = useMemo(() => computeTeamAverages(filteredGames), [filteredGames]);

  const offRatedGames = filteredGames.filter((g: any) => g.offRating != null);
  const defRatedGames = filteredGames.filter((g: any) => g.defRating != null);
  const offRtgAvg = offRatedGames.length > 0
    ? +(offRatedGames.reduce((a: number, g: any) => a + g.offRating, 0) / offRatedGames.length).toFixed(1)
    : null;
  const defRtgAvg = defRatedGames.length > 0
    ? +(defRatedGames.reduce((a: number, g: any) => a + g.defRating, 0) / defRatedGames.length).toFixed(1)
    : null;

  const playerPpg = players.map((p: any) => {
    const rows = filteredGames
      .flatMap((g: any) => (g.boxScore || []).filter((r: any) => r.pid === p.id && r.min > 0));
    const n = rows.length;
    if (n === 0) return null;
    const ppg = +(rows.reduce((a: number, r: any) => a + (r.pts || 0), 0) / n).toFixed(1);
    return { id: p.id, name: p.name, ppg, gp: n };
  }).filter(Boolean).sort((a: any, b: any) => b.ppg - a.ppg).slice(0, 5);

  const playerEff = players.map((p: any) => {
    const rows = filteredGames
      .flatMap((g: any) => (g.boxScore || []).filter((r: any) => r.pid === p.id && r.min > 0));
    const n = rows.length;
    if (n === 0) return null;
    const eff = +(rows.reduce((a: number, r: any) => a + (r.eff || 0), 0) / n).toFixed(1);
    return { id: p.id, name: p.name, eff, gp: n };
  }).filter(Boolean).sort((a: any, b: any) => b.eff - a.eff).slice(0, 5);

  const minutesDist = players
    .map((p: any) => {
      const rows = filteredGames
        .flatMap((g: any) => (g.boxScore || []).filter((r: any) => r.pid === p.id && r.min > 0));
      const n = rows.length;
      if (n === 0) return null;
      return {
        name: fmt(p.name),
        mpg:  +(rows.reduce((a: number, r: any) => a + (r.min || 0), 0) / n).toFixed(1),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.mpg - a.mpg);

  if (games.length === 0) {
    return (
      <Layout title="Team Stats">
        <SectionHeading label="2025-26 Season" title="Team Stats" />
        <div className="text-center p-12 text-ak-text-dim">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-[15px] font-bold">No data yet</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Team Stats">
      <SectionHeading label="2025-26 Season" title="Team Stats" />

      <SeasonSelector seasons={seasons} currentSeason={currentSeason} onChange={handleSeasonChange} showAllTime={false} right={`${gp} Games Played`} />

      <div className="flex items-center gap-1.5 mb-4">
        {(["all", "regular", "playoffs"] as const).map(f => (
          <button
            key={f}
            onClick={() => setPhaseFilter(f)}
            className={`${TAB_BASE} ${phaseFilter === f ? TAB_ACTIVE : TAB_INACTIVE}`}
          >
            {f === "all" ? "All Season" : f === "regular" ? "Regular Season" : "Playoffs"}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {leagueTabs.map(t => (
          <button
            key={t.key}
            className={`${TAB_BASE} ${league === t.key ? TAB_ACTIVE : TAB_INACTIVE}`}
            onClick={() => setLeague(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {gp === 0 ? (
        <div className="text-center p-12 text-ak-text-dim rounded-xl border border-ak-border bg-ak-surface">
          <div className="text-[13px] font-bold">No {leagueTabs.find(t => t.key === league)?.label ?? league} games recorded yet</div>
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-6">
            {/* Scoring */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] self-stretch rounded-sm bg-ak-red-bright min-h-[16px]" />
                <div className="text-[11px] font-black tracking-[0.15em] text-ak-red-text uppercase">Scoring</div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                <StatTile label="PPG"     value={rec.ppg}     sub="points per game"  highlight />
                <StatTile label="OPP PPG" value={rec.oppPpg}  sub="allowed per game" />
              </div>
            </div>
            {/* Defence */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] self-stretch rounded-sm bg-ak-red-bright min-h-[16px]" />
                <div className="text-[11px] font-black tracking-[0.15em] text-ak-red-text uppercase">Defence &amp; Ball Control</div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                <StatTile label="RPG"        value={teamAvg.rpg}     sub="rebounds" />
                <StatTile label="SPG"        value={teamAvg.spg}     sub="steals" />
                <StatTile label="BPG"        value={teamAvg.bpg}     sub="blocks" />
                <StatTile label="TOV"        value={teamAvg.tpg}     sub="turnovers" />
              </div>
            </div>
            {/* Playmaking & Efficiency */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] self-stretch rounded-sm bg-ak-red-bright min-h-[16px]" />
                <div className="text-[11px] font-black tracking-[0.15em] text-ak-red-text uppercase">Playmaking &amp; Efficiency</div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                <StatTile label="APG"         value={teamAvg.apg}          sub="assists" />
                <StatTile label="AST/TOV"     value={teamAvg.atRatio}      sub="ratio" />
                <StatTile label="OFF RTG"     value={offRtgAvg ?? "-"}     sub="offensive rating" />
                <StatTile label="DEF RTG"     value={defRtgAvg ?? "-"}     sub="defensive rating" />
              </div>
            </div>
            {/* Shooting */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] self-stretch rounded-sm bg-ak-red-bright min-h-[16px]" />
                <div className="text-[11px] font-black tracking-[0.15em] text-ak-red-text uppercase">Shooting</div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                <StatTile label="FG%"  value={`${teamAvg.fgPct}%`}  sub="field goal %" />
                <StatTile label="3P%"  value={`${teamAvg.fg3Pct}%`} sub="three-point %" />
                <StatTile label="FT%"  value={`${teamAvg.ftPct}%`}  sub="free throw %" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5 mb-5">
            <RecordBreakdown rec={rec} />
            <ShootingSplits teamAvg={teamAvg} />
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 mb-5">
            <div className="rounded-xl p-5 border border-ak-border bg-ak-surface">
              <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-4 uppercase">Top Scorers - PPG</div>
              {playerPpg.length === 0
                ? <div className="text-xs text-ak-text-dim">No data</div>
                : playerPpg.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between mb-[10px]">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black w-4 ${i === 0 ? "text-ak-red-text" : "text-ak-text-dim"}`}>{i + 1}</span>
                      <span className="text-[13px] font-bold text-ak-text">{fmt(p.name)}</span>
                      <span className="text-[10px] text-ak-text-dim">{p.gp}G</span>
                    </div>
                    <span className={`text-base font-black ${i === 0 ? "text-ak-red-text" : "text-ak-text"}`}>{p.ppg}</span>
                  </div>
                ))
              }
            </div>

            <div className="rounded-xl p-5 border border-ak-border bg-ak-surface">
              <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-4 uppercase">Efficiency Leaders</div>
              {playerEff.length === 0
                ? <div className="text-xs text-ak-text-dim">No data</div>
                : playerEff.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between mb-[10px]">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black w-4 ${i === 0 ? "text-ak-red-text" : "text-ak-text-dim"}`}>{i + 1}</span>
                      <span className="text-[13px] font-bold text-ak-text">{fmt(p.name)}</span>
                      <span className="text-[10px] text-ak-text-dim">{p.gp}G</span>
                    </div>
                    <span className={`text-base font-black ${i === 0 ? "text-ak-red-text" : "text-ak-text"}`}>{p.eff}</span>
                  </div>
                ))
              }
            </div>
          </div>

          <MinutesChart minutesDist={minutesDist} />
        </>
      )}
    </Layout>
  );
}

export async function getStaticProps() {
  try {
    const { seasons, currentSeason, players, games } = await getAllPublicData(null);
    return { props: { players, games, seasons, currentSeason }, revalidate: 3600 };
  } catch {
    // ponytail: DB unavailable at build time (e.g. CI); ISR revalidates on first request.
    return { props: { players: [], games: [], seasons: [], currentSeason: "" }, revalidate: 60 };
  }
}
