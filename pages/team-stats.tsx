import { useState, useMemo } from "react";
import Layout from "../components/Layout";
import { SectionHeading, StatTile } from "../components/ui";
import { C, chartTooltipStyle } from "../lib/theme";
import { getAllPublicData } from "../lib/data";
import { computeRecord, computeTeamAverages } from "../lib/stats";
import { fmt, fmtMinutes } from "../lib/utils";
import SeasonSelector from "../components/SeasonSelector";
import ErrorBoundary from "../components/ErrorBoundary";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "../components/Charts";

const TAB_BASE = "px-4 py-[6px] text-[11px] font-black tracking-[0.12em] uppercase rounded-lg cursor-pointer border transition-all duration-150";
const TAB_ACTIVE   = "border-ak-red bg-ak-red text-ak-text";
const TAB_INACTIVE = "border-ak-border bg-transparent text-ak-text-dim";

export default function TeamPage({ players, games, seasons, currentSeason }: any) {
  const [league, setLeague] = useState("all");

  const handleSeasonChange = (sid: any) => {
    window.location.href = sid === "all-time" ? "/team-stats" : `/team-stats?season=${sid}`;
  };

  // Derive league tabs from the actual games data so any new league added to
  // the DB automatically appears without code changes.
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

  // Filter by the active tab using the raw DB slug.
  const filteredGames = useMemo(
    () => league === "all" ? games : games.filter((g: any) => g.league === league),
    [league, games],
  );

  const gp = filteredGames.length;

  // filteredGames is already scoped to the active league tab -- pass no
  // leagueFilter so computeRecord doesn't re-filter and produce wrong PPG
  // for the "all" tab (where no game has g.league === "all").
  const rec = useMemo(() => computeRecord(filteredGames), [filteredGames]);

  const teamAvg = useMemo(() => computeTeamAverages(filteredGames), [filteredGames]);

  // Offensive / Defensive Rating -- game-level floats, averaged across filtered games
  const offRatedGames = filteredGames.filter((g: any) => g.offRating != null);
  const defRatedGames = filteredGames.filter((g: any) => g.defRating != null);
  const offRtgAvg   = offRatedGames.length > 0
    ? +(offRatedGames.reduce((a: number, g: any) => a + g.offRating, 0) / offRatedGames.length).toFixed(1)
    : null;
  const defRtgAvg   = defRatedGames.length > 0
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

  // Minutes distribution -- horizontal bar chart, fmt() gives "Lastname F."
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

      {/* League tabs -- derived from games data, always reflects actual DB state */}
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
          {/* Key averages */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3 mb-6">
            <StatTile label="PPG"     value={rec.ppg}             sub="" highlight />
            <StatTile label="OPP PPG" value={rec.oppPpg}          sub="" />
            <StatTile label="RPG"     value={teamAvg.rpg}         sub="" />
            <StatTile label="APG"     value={teamAvg.apg}         sub="" />
            <StatTile label="SPG"     value={teamAvg.spg}         sub="" />
            <StatTile label="BPG"     value={teamAvg.bpg}         sub="" />
            <StatTile label="TOV"     value={teamAvg.tpg}         sub="" />
            <StatTile label="Assists/TOV"     value={teamAvg.atRatio}     sub="" />
            <StatTile label="OFF RTG" value={offRtgAvg ?? "--"}    sub="" />
            <StatTile label="DEF RTG" value={defRtgAvg ?? "--"}    sub="" />
            <StatTile label="FG%"     value={`${teamAvg.fgPct}%`}  sub="" />
            <StatTile label="3P%"     value={`${teamAvg.fg3Pct}%`} sub="" />
            <StatTile label="FT%"     value={`${teamAvg.ftPct}%`}  sub="" />
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5 mb-5">
            {/* Record breakdown */}
            <div className="rounded-xl p-5 border border-ak-border bg-ak-surface">
              <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-4 uppercase">Record Breakdown</div>
              {([
                ["Overall", rec.wins,     rec.losses],
                ["Home",    rec.homeWins, rec.homeLosses],
                ["Away",    rec.awayWins, rec.awayLosses],
              ] as [string, number, number][]).map(([label, w, l]) => (
                <div key={label} className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-bold text-ak-text-sub">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-ak-text">{w}-{l}</span>
                    <span className="text-[11px] text-ak-text-dim">{w+l > 0 ? `${(w/(w+l)*100).toFixed(0)}%` : "--"}</span>
                  </div>
                </div>
              ))}
              <div className="mt-4 pt-3 border-t border-ak-border">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-ak-text-sub">Current Streak</span>
                  <span className={`text-sm font-black ${rec.streak.count === 0 ? "text-ak-text-dim" : rec.streak.type === "W" ? "text-ak-green" : "text-ak-red-text"}`}>
                    {rec.streak.count === 0 ? "--" : `${rec.streak.count}${rec.streak.type}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Shooting */}
            <div className="rounded-xl p-5 border border-ak-border bg-ak-surface">
              <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-4 uppercase">Shooting Splits</div>
              {([
                ["Field Goals",  teamAvg.fgPct],
                ["3-Pointers",   teamAvg.fg3Pct],
                ["Free Throws",  teamAvg.ftPct],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold text-ak-text-sub">{label}</span>
                    <span className="text-[13px] font-black text-ak-text">{val}%</span>
                  </div>
                  <div className="h-1 rounded-sm bg-ak-border">
                    {/* runtime float -- unavoidable inline style */}
                    <div className="h-full rounded-sm bg-ak-red-bright transition-[width] duration-[400ms]" style={{ width: `${Math.min(100, val)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Scorers + Efficiency Leaders */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 mb-5">
            <div className="rounded-xl p-5 border border-ak-border bg-ak-surface">
              <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-4 uppercase">Top Scorers -- PPG</div>
              {playerPpg.length === 0
                ? <div className="text-xs text-ak-text-dim">No data</div>
                : playerPpg.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between mb-[10px]">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black w-4 ${i===0 ? "text-ak-red-text" : "text-ak-text-dim"}`}>{i+1}</span>
                      <span className="text-[13px] font-bold text-ak-text">{fmt(p.name)}</span>
                      <span className="text-[10px] text-ak-text-dim">{p.gp}G</span>
                    </div>
                    <span className={`text-base font-black ${i===0 ? "text-ak-red-text" : "text-ak-text"}`}>{p.ppg}</span>
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
                      <span className={`text-[10px] font-black w-4 ${i===0 ? "text-ak-red-text" : "text-ak-text-dim"}`}>{i+1}</span>
                      <span className="text-[13px] font-bold text-ak-text">{fmt(p.name)}</span>
                      <span className="text-[10px] text-ak-text-dim">{p.gp}G</span>
                    </div>
                    <span className={`text-base font-black ${i===0 ? "text-ak-red-text" : "text-ak-text"}`}>{p.eff}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Minutes distribution -- horizontal bar chart, mobile-friendly */}
          {minutesDist.length > 0 && (
            <div
              className="rounded-xl p-5 border border-ak-border bg-ak-surface"
              role="img"
              aria-label="Minutes Distribution Chart (MPG)"
            >
              <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-4 uppercase">Minutes Distribution (MPG)</div>
              <ResponsiveContainer width="100%" height={minutesDist.length * 40}>
                <BarChart
                  data={minutesDist}
                  layout="vertical"
                  margin={{ top:10, right:20, left:0, bottom:10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill:C.textDim, fontSize:11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 40]}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill:C.textSub, fontSize:12, fontWeight:700 }}
                    axisLine={false}
                    tickLine={false}
                    width={130}
                  />
                  <Tooltip
                    {...chartTooltipStyle}
                    formatter={(value) => [fmtMinutes(value as number)]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
                  />
                  <Bar
                    dataKey="mpg"
                    radius={[0,4,4,0]}
                    maxBarSize={Math.min(40, 600 / minutesDist.length)}
                    label={{ position:"right", fill:C.textDim, fontSize:11, fontWeight:700, formatter:(v: any) => fmtMinutes(v) }}
                    isAnimationActive={true}
                  >
                    {minutesDist.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.highlight || i === 0 ? C.redBright : C.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

export async function getStaticProps() {
  const { seasons, currentSeason, players, games } = await getAllPublicData(null);
  return { props: { players, games, seasons, currentSeason }, revalidate: 86400 };
}
