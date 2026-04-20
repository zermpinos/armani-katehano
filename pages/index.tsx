import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { StatTile, SectionHeading } from "../components/ui";
import { C, chartTooltipStyle } from "../lib/theme";
import { getAllPublicData, getUpcomingGamesWithAnnouncements } from "../lib/data";
import { computeRecord } from "../lib/stats";
import { fmt, fmtDate, fmtMinutes } from "../lib/utils";
import ErrorBoundary from "../components/ErrorBoundary";
import { PlayerDetail } from "../components/PlayerDetail";
import { LineChart, Line, BarChart, Bar, Cell, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "../components/Charts";
import Link from "next/link";
import { getVenueUrl } from "../lib/venues";
import { getCountdownInfo, formatGameTime, downloadIcsFile, buildGoogleCalendarUrl } from "@/client/home/calendar-utils";
import { ShowMoreButton } from "@/client/home/show-more-button";
import { GoogleCalIcon } from "@/client/home/google-cal-icon";
import { RosterPanel } from "@/client/home/roster-panel";
import { ConfirmToast } from "@/client/home/confirm-toast";
import { SubscribeForm } from "@/client/home/subscribe-form";
import { ScoringTrendModal } from "@/client/home/scoring-trend-modal";

export default function HomePage({ players, games, stats, upcomingGames, currentSeason }: any) {
  const [trendRange, setTrendRange] = useState(10);
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [openRosterId, setOpenRosterId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const toggleRoster = (id: string) => setOpenRosterId(prev => prev === id ? null : id);

  const playersWithStats = players.map((p: any) => ({
    ...p,
    stats: stats[p.id] ?? { ppg:0, rpg:0, apg:0, fgPct:0, eff:0, mpg:0, gp:0 },
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
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, rangeGames)
      .reverse()
      .map((g, i) => {
        const parts = (g.score || "0–0").split(/[–-]/);
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
    .filter(p => p.stats.ppg > 0)
    .sort((a, b) => b.stats.ppg - a.stats.ppg)
    .slice(0, 5);

  const topScorers = topPlayers.map(p => ({ name: fmt(p.name), ppg: p.stats.ppg }));

  const trend = generateTrendData(10);
  const extendedTrend = generateTrendData(trendRange);

  const recentGames = [...games]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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
          <div className="text-[11px] font-black tracking-[0.18em] uppercase text-ak-red-text mb-2">2025–26 · Regular Season</div>
          <h1 className="text-[clamp(36px,6vw,64px)] font-black leading-none tracking-[-0.02em] uppercase text-ak-text">
            Armani<br /><span className="text-ak-red-bright">Katehano</span>
          </h1>
          <p className="mt-3 text-[13px] font-semibold text-ak-text-sub">
            {record.wins}–{record.losses}
            {record.streak.count > 0 && <> · <span className="text-ak-red-text">{record.streak.count}-game {record.streak.type === "W" ? "win" : "loss"} streak</span></>}
            {" "}· <span className="text-ak-red-text">{winPct}%</span> win rate
          </p>
        </div>
      </div>

      {/* Record tiles */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 mb-6">
        <StatTile label="Record"  value={`${record.wins}–${record.losses}`} sub={`${winPct}% win rate`} />
        <StatTile label="Streak"  value={record.streak.count > 0 ? `${record.streak.count}${record.streak.type}` : "—"} sub="current streak" highlight={record.streak.type === "W" && record.streak.count > 0} />
        <StatTile label="PPG"     value={record.ppg    || "—"} sub="points per game" />
        <StatTile label="OPP PPG" value={record.oppPpg || "—"} sub="allowed per game" />
      </div>

      {/* Upcoming Games */}
      {upcomingGames?.length > 0 && (() => {
        const featured = upcomingGames[0];
        const rest = upcomingGames.slice(1);
        const { label: featLabel, tier: featTier } = getCountdownInfo(featured.scheduledFor);
        const featTime = formatGameTime(featured.scheduledFor);
        const isToday = featTier === "today";
        const isWeek  = featTier === "week";
        const featAccentCls = isToday ? "text-ak-gold" : isWeek ? "text-ak-red-text" : "text-ak-text-sub";
        const featVenue  = featured.notes;

        return (
          <div className="rounded-2xl py-5 px-4 border border-ak-border bg-ak-surface mb-6 shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
            {/* Section header */}
            <div className="mb-[14px]">
              <div className="text-[11px] font-black tracking-[0.18em] text-ak-text-dim uppercase">Schedule</div>
              <h2 className="text-[clamp(16px,5vw,18px)] font-bold text-ak-text mt-1 mb-0">Upcoming Games</h2>
            </div>

            {/* ── Featured card: next game ── */}
            <div className={`rounded-[14px] py-[18px] px-5 border ${
              isToday ? "border-[#c9a84c55] bg-[#c9a84c0d] shadow-[0_8px_24px_#c9a84c18]"
              : isWeek ? "border-[#e0555535] bg-[#e055550a] shadow-[0_4px_16px_#e0555512]"
              : "border-ak-border2 bg-ak-surface2 shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
            } ${rest.length > 0 ? "mb-[10px]" : ""}`}>
              {/* Top label */}
              <div className={`text-[10px] font-black tracking-[0.18em] uppercase mb-3 ${isToday ? "text-ak-gold" : "text-ak-red-text"}`}>
                {isToday ? "⚡ Today" : "Next Game"}
              </div>
              {/* Main row: left info | right badge + buttons */}
              <div className="flex items-start justify-between gap-4">
                {/* Left */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                    <div className="text-[clamp(18px,5vw,24px)] font-black text-ak-text leading-[1.15]">
                      {featured.location === "home" ? "vs" : "@"} {featured.opponent}
                    </div>
                    <div className={`text-[clamp(13px,3vw,15px)] font-bold ${featAccentCls}`}>{featTime}</div>
                  </div>
                  {featured.competition && (
                    <div className="text-xs text-ak-text-dim font-medium mb-1">{featured.competition}</div>
                  )}
                  {featVenue && (
                    <a
                      href={getVenueUrl(featVenue)}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-ak-text-sub no-underline transition-colors duration-200 mt-0.5 hover:text-ak-red-text"
                    >
                      📍 {featVenue}
                    </a>
                  )}
                </div>
                {/* Right: badge + calendar buttons side by side */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className={`text-[11px] font-bold ${featAccentCls} py-[3px] px-[10px] rounded-full whitespace-nowrap ${
                    isToday ? "bg-[#c9a84c20]" : isWeek ? "bg-[#e0555512]" : "bg-[#a8a8ac10]"
                  } tracking-[0.03em]`}>
                    {featLabel}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Google Calendar */}
                    <a
                      href={buildGoogleCalendarUrl(featured.opponent, featured.scheduledFor, featVenue)}
                      target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 py-[7px] px-3 rounded-lg border border-[#4285F440] bg-[#4285F410] text-[#4285F4] text-[11px] font-bold no-underline cursor-pointer whitespace-nowrap transition-all duration-200 hover:bg-[#4285F420] hover:border-[#4285F465]"
                    >
                      <GoogleCalIcon />
                      Google
                    </a>
                    {/* Download .ics */}
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadIcsFile(featured.opponent, featured.scheduledFor, featVenue); }}
                      className="inline-flex items-center gap-1.5 py-[7px] px-3 rounded-lg border border-ak-border2 bg-ak-base text-ak-text-sub text-[11px] font-bold cursor-pointer whitespace-nowrap transition-all duration-200 hover:text-ak-text"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      .ics
                    </button>
                  </div>
                </div>
              </div>

              {/* Roster section */}
              <div className="mt-3 pt-[10px] border-t border-ak-border">
                {featured.announcement ? (
                  <>
                    <button
                      onClick={() => toggleRoster(featured.id)}
                      className="bg-transparent border-0 text-[11px] font-bold text-ak-text-dim cursor-pointer tracking-[0.1em] uppercase py-0.5 px-0 flex items-center gap-1.5 hover:text-ak-text-sub transition-colors duration-150"
                    >
                      {openRosterId === featured.id
                        ? "Hide Roster ↑"
                        : `View Roster (${featured.announcement.players.length} players) →`}
                    </button>
                    {openRosterId === featured.id && <RosterPanel announcement={featured.announcement} onPlayerClick={openPlayerById} />}
                  </>
                ) : (
                  <div className="text-[11px] text-ak-text-dim tracking-[0.04em]">Roster TBA</div>
                )}
              </div>
            </div>

            {/* ── Compact cards: remaining games ── */}
            {rest.length > 0 && (
              <div className="flex flex-col gap-[5px]">
                {(showAllUpcoming ? rest : rest.slice(0, 3)).map((g: any) => {
                  const { label, tier } = getCountdownInfo(g.scheduledFor);
                  const gameTime = formatGameTime(g.scheduledFor);
                  const accentCls = tier === "today" ? "text-ak-gold" : tier === "week" ? "text-ak-red-text" : "text-ak-text-sub";
                  const venue = g.notes;
                  const rosterOpen = openRosterId === g.id;
                  return (
                    <div key={g.id}>
                      <div
                        className={`flex items-center justify-between gap-[10px] py-[10px] px-[14px] border bg-transparent transition-all duration-150 hover:bg-ak-surface2 ${
                          rosterOpen
                            ? "rounded-t-[10px] border-[#4caf7d40]"
                            : "rounded-[10px] border-ak-border"
                        }`}
                      >
                        {/* Left: info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-[13px] font-bold text-ak-text">
                              {g.location === "home" ? "vs" : "@"} {g.opponent}
                            </span>
                            <span className={`text-[11px] font-semibold ${accentCls}`}>{gameTime}</span>
                            {g.competition && (
                              <span className="text-[11px] text-ak-text-dim">· {g.competition}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-ak-text-dim mt-0.5">{label}</div>
                        </div>
                        {/* Right: icon-only buttons + roster toggle */}
                        <div className="flex items-center gap-[5px] shrink-0">
                          <a
                            href={buildGoogleCalendarUrl(g.opponent, g.scheduledFor, venue)}
                            target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Add to Google Calendar"
                            className="flex items-center justify-center w-7 h-7 rounded-[7px] border border-ak-border bg-ak-base no-underline transition-all duration-150 hover:border-[#4285F4] hover:bg-[#4285F412]"
                          >
                            <GoogleCalIcon />
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadIcsFile(g.opponent, g.scheduledFor, venue); }}
                            title="Download .ics"
                            className="flex items-center justify-center w-7 h-7 rounded-[7px] border border-ak-border bg-ak-base text-ak-text-dim cursor-pointer transition-all duration-150 hover:border-ak-border2 hover:text-ak-text-sub"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                              <polyline points="7 10 12 15 17 10"/>
                              <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleRoster(g.id); }}
                            title={g.announcement ? (rosterOpen ? "Hide roster" : "View roster") : "Roster TBA"}
                            disabled={!g.announcement}
                            className={`flex items-center justify-center w-7 h-7 rounded-[7px] border text-[10px] font-black tracking-[0.05em] transition-all duration-150 ${
                              rosterOpen
                                ? "border-[#4caf7d60] bg-[#4caf7d15] text-ak-green cursor-pointer"
                                : g.announcement
                                  ? "border-ak-border bg-ak-base text-ak-text-dim cursor-pointer hover:border-ak-border2 hover:text-ak-text-sub"
                                  : "border-ak-border bg-ak-base text-ak-text-dim cursor-default opacity-40"
                            }`}
                          >
                            {g.announcement ? (rosterOpen ? "↑" : `${g.announcement.players.length}`) : "—"}
                          </button>
                        </div>
                      </div>
                      {rosterOpen && g.announcement && (
                        <div className="py-[10px] px-[14px] pb-3 border border-[#4caf7d40] border-t-0 rounded-b-[10px] bg-[#4caf7d05]">
                          <RosterPanel announcement={g.announcement} onPlayerClick={openPlayerById} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Show More — ghost style, matches "BOX SCORE →" in games.tsx */}
                {!showAllUpcoming && rest.length > 3 && (
                  <div className="text-center pt-1">
                    <ShowMoreButton onClick={() => setShowAllUpcoming(true)}>
                      {rest.length - 3} more game{rest.length - 3 !== 1 ? "s" : ""} →
                    </ShowMoreButton>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      <SubscribeForm />

      <ErrorBoundary label="Stats failed to load">
      {hasData && (
        <div className="grid grid-cols-1 gap-5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">

            {/* Scoring trend */}
            {trend.length > 0 && (
              <div className="rounded-2xl p-5 border border-ak-border bg-ak-surface shadow-[0_4px_16px_rgba(0,0,0,0.25)] flex flex-col min-h-[320px]">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase">Scoring Trend</div>
                    <div className="text-lg font-bold text-ak-text">Last {trend.length} Games</div>
                  </div>
                  <ShowMoreButton className="show-more-btn" onClick={() => setShowTrendModal(true)}>Show More →</ShowMoreButton>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend} margin={{ top:4, right:8, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.redBright} stopOpacity={0.25}/>
                        <stop offset="100%" stopColor={C.red} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke={C.border2} vertical={false} />
                    <XAxis dataKey="idx" tick={false} axisLine={{ stroke: C.border2 }} tickLine={false} />
                    <YAxis width={32} tick={{ fill:C.textDim, fontSize:11 }} axisLine={false} tickLine={false} domain={["auto","auto"]} />
                    <Tooltip
                      {...chartTooltipStyle}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const entries = payload.filter(p => p.name === "AK" || p.name === "OPP");
                        if (!entries.length) return null;
                        const game = payload[0]?.payload?.game;
                        return (
                          <div className="bg-ak-surface2 border border-ak-border2 rounded-lg text-xs text-ak-text">
                            {game && <div className="text-[10px] text-ak-text-dim mb-1">{game}</div>}
                            {entries.map(p => (
                              <div key={p.name} className={p.name === "AK" ? "text-ak-red-bright" : "text-ak-silver"}>{p.name}: {p.value}</div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Area type="monotone" dataKey="pts" stroke="none" fill="url(#trendFill)" legendType="none" />
                    <Line type="monotone" dataKey="pts" stroke={C.redBright} strokeWidth={3} dot={{ fill:C.redBright, r:3, strokeWidth:0 }} activeDot={{ r:5 }} name="AK" />
                    <Line type="monotone" dataKey="opp" stroke={C.silver} strokeWidth={2} dot={{ fill:C.silver, r:3, strokeWidth:0 }} activeDot={{ r:5 }} strokeDasharray="5 5" name="OPP" />
                    <Legend wrapperStyle={{ fontSize:11, color:C.textSub }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Recent results */}
            {recentGames.length > 0 && (
              <div className="rounded-2xl p-5 border border-ak-border bg-ak-surface shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
                <div className="mb-[14px] flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase">Recent Results</div>
                    <div className="text-lg font-bold text-ak-text mt-0.5">Last {recentGames.length} Games</div>
                  </div>
                  <ShowMoreButton href="/games" className="show-more-btn">All Games →</ShowMoreButton>
                </div>

                {/* Featured: most recent game */}
                {(() => {
                  const g = recentGames[0];
                  const isWin = g.result === "W";
                  return (
                    <div className={`rounded-xl py-[14px] px-4 mb-2 border flex items-center justify-between gap-3 ${
                      isWin ? "border-[#4caf7d30] bg-[rgba(16,185,129,0.06)]" : "border-[#e0555525] bg-[#8b1a1a08]"
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-black shrink-0 border ${
                          isWin
                            ? "bg-[rgba(16,185,129,0.15)] text-[#6ee7b7] border-[rgba(16,185,129,0.25)]"
                            : "bg-[#8b1a1a35] text-ak-red-text border-[#e0555530]"
                        }`}>{g.result}</span>
                        <div>
                          <div className="text-[15px] font-extrabold text-ak-text">{g.home ? "vs" : "@"} {g.opponent}</div>
                          <div className="text-[11px] text-ak-text-dim mt-0.5">{fmtDate(g.date)}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-xl font-black ${isWin ? "text-ak-green" : "text-ak-red-text"}`}>{g.score}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Compact: remaining games */}
                <div className="flex flex-col">
                  {recentGames.slice(1).map((g, i) => {
                    const isWin = g.result === "W";
                    return (
                      <div key={g.id} className="flex items-center justify-between gap-[10px] py-[9px] px-1 border-t border-ak-border">
                        <div className="flex items-center gap-[9px]">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                            isWin ? "bg-[rgba(16,185,129,0.10)] text-[#6ee7b7]" : "bg-[#8b1a1a25] text-ak-red-text"
                          }`}>{g.result}</span>
                          <div>
                            <div className="text-xs font-semibold text-ak-text-sub">{g.home ? "vs" : "@"} {g.opponent}</div>
                            <div className="text-[10px] text-ak-text-dim">{fmtDate(g.date)}</div>
                          </div>
                        </div>
                        <div className="text-xs font-bold text-ak-text-sub">{g.score}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
            {/* Top scorers */}
            {topScorers.length > 0 && (
              <div
                className="rounded-2xl p-5 border border-ak-border bg-ak-surface shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
                role="img"
                aria-label="Top Scorers — PPG"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase">Top Scorers — PPG</div>
                  <ShowMoreButton href="/players" className="show-more-btn">All Players →</ShowMoreButton>
                </div>
                <ResponsiveContainer width="100%" height={topScorers.length * 44}>
                  <BarChart data={topScorers} layout="vertical" margin={{ top:10, right:40, left:0, bottom:10 }}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={C.red} />
                        <stop offset="100%" stopColor={C.redBright} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                    <XAxis type="number" tick={{ fill:C.textDim, fontSize:11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill:C.textSub, fontSize:12, fontWeight:700 }}
                      axisLine={false}
                      tickLine={false}
                      width={130}
                    />
                    <Tooltip {...chartTooltipStyle} formatter={(v: any) => [`${v} PPG`]} />
                    <Bar
                      dataKey="ppg"
                      fill="url(#barGrad)"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={Math.min(40, 600 / topScorers.length)}
                      label={{ position:"right", fill:C.textDim, fontSize:11, fontWeight:700 }}
                      isAnimationActive={true}
                    >
                      {topScorers.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? C.redBright : `url(#barGrad)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Efficiency leader card */}
            {mvp && mvp.stats.eff > 0 && (
              <div className="rounded-2xl p-5 relative overflow-hidden border border-[#c0392b35] bg-ak-surface shadow-[0_1px_1px_rgba(0,0,0,0.25)]">
                <div className="absolute top-0 right-0 w-[140px] h-[140px] rounded-full bg-[#8b1a1a12] translate-x-[40%] -translate-y-[40%]" />
                {/* Header */}
                <div className="mb-[14px] relative z-[1] flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-black tracking-[0.15em] text-ak-red-text uppercase">⚡ Efficiency Leader</div>
                  </div>
                  <ShowMoreButton href="/players" className="show-more-btn">All Players →</ShowMoreButton>
                </div>
                {/* Featured player */}
                <div className="rounded-xl py-[14px] px-4 mb-3 border border-[#e0555525] bg-[#8b1a1a08] flex items-center justify-between gap-3 relative z-[1]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-[#8b1a1a20] border border-[#e0555530] shrink-0 text-base">
                      🏀
                    </div>
                    <div>
                      <div className="text-[15px] font-extrabold text-ak-text">{fmt(mvp.name)}</div>
                      <div className="text-[11px] font-bold text-ak-text-dim mt-0.5">#{mvp.number} · {mvp.position}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[22px] font-black text-ak-red-text">{mvp.stats.eff}</div>
                    <div className="text-[10px] font-bold text-ak-text-dim tracking-[0.1em]">EFF</div>
                  </div>
                </div>
                {/* Stat grid */}
                <div className="grid grid-cols-3 gap-2 relative z-[1]">
                  {[
                    ["PPG", mvp.stats.ppg],
                    ["RPG", mvp.stats.rpg],
                    ["APG", mvp.stats.apg],
                    ["FG%", `${mvp.stats.fgPct}%`],
                    ["GP",  mvp.stats.gp],
                    ["MPG", mvp.stats.mpg > 0 ? fmtMinutes(mvp.stats.mpg) : "—"],
                  ].map(([l, v]) => (
                    <div key={l} className="text-center rounded-lg py-2 px-1 bg-ak-base border border-ak-border">
                      <div className="text-[10px] font-black tracking-[0.12em] text-ak-text-dim">{l}</div>
                      <div className="text-[13px] font-black text-ak-text mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
