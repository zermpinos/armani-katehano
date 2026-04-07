import { useState } from "react";
import Layout from "../components/Layout";
import { StatTile, SectionHeading } from "../components/ui";
import { C, chartTooltipStyle } from "../lib/theme";
import { getAllPublicData } from "../lib/data";
import { computeRecord } from "../lib/stats";
import { fmt, fmtDate, fmtMinutes } from "../lib/utils";
import ErrorBoundary from "../components/ErrorBoundary";
import { LineChart, Line, BarChart, Bar, Cell, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "../components/Charts";
import Link from "next/link";

// Countdown badge logic -- determines tier and label for upcoming games
function getCountdownInfo(isoStr: string): { label: string; tier: "today" | "week" | "future" } {
  const now = new Date();
  const gameTime = new Date(isoStr);

  // Normalize to start of day for date comparisons
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const gameDay = new Date(gameTime.getFullYear(), gameTime.getMonth(), gameTime.getDate());
  const daysUntil = Math.ceil((gameDay.getTime() - todayStart.getTime()) / 86400000);

  // Format time in 24-hour format (HH:MM)
  const fmtTime = () => isoStr.slice(11, 16);

  if (daysUntil === 0)       return { label: `Today at ${fmtTime()}`, tier: "today" };
  if (daysUntil === 1)       return { label: `Tomorrow at ${fmtTime()}`, tier: "week" };
  if (daysUntil <= 6)        return { label: `In ${daysUntil} days`, tier: "week" };
  /* future */               return { label: fmtDate(isoStr), tier: "future" };
}

// Format time in 24-hour format (HH:MM)
function formatGameTime(isoStr: string): string {
  return isoStr.slice(11, 16);
}

// Generate Google Calendar link
function getGoogleCalendarLink(opponent: string, isoStr: string, venue?: string): string {
  const gameTime = new Date(isoStr);
  const endTime = new Date(gameTime.getTime() + 120 * 60000); // 2 hours duration

  const formatGoogleTime = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const title = encodeURIComponent(`Armani Katehano vs ${opponent}`);
  const details = encodeURIComponent(venue ? `Venue: ${venue}` : "Game");
  const location = encodeURIComponent(venue || "");
  const dates = `${formatGoogleTime(gameTime)}/${formatGoogleTime(endTime)}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${dates}`;
}

// Generate Apple Calendar (iCal) link
function getAppleCalendarLink(opponent: string, isoStr: string, venue?: string): string {
  const gameTime = new Date(isoStr);
  const endTime = new Date(gameTime.getTime() + 120 * 60000); // 2 hours duration

  const formatICalTime = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const title = `Armani Katehano vs ${opponent}`;
  const description = venue ? `Venue: ${venue}` : "";

  const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Armani Katehano//EN
BEGIN:VEVENT
DTSTART:${formatICalTime(gameTime)}
DTEND:${formatICalTime(endTime)}
SUMMARY:${title}
DESCRIPTION:${description}
END:VEVENT
END:VCALENDAR`;

  const encoded = encodeURIComponent(ical);
  return `data:text/calendar,${encoded}`;
}


export default function HomePage({ players, games, stats, upcomingGames }: any) {
  const [trendRange, setTrendRange] = useState(10);
  const [showTrendModal, setShowTrendModal] = useState(false);

  const playersWithStats = players.map((p: any) => ({
    ...p,
    stats: stats[p.id] ?? { ppg:0, rpg:0, apg:0, fgPct:0, eff:0, mpg:0, gp:0 },
  }));

  const record = computeRecord(games);

  const winPct = record.wins + record.losses > 0
    ? (record.wins / (record.wins + record.losses) * 100).toFixed(1)
    : "0.0";

  const activePlayers = playersWithStats.filter((p: any) => (p.stats.gp ?? 0) > 0);
  const mvp = activePlayers.length
    ? activePlayers.reduce((b: any, p: any) => p.stats.eff > b.stats.eff ? p : b, activePlayers[0])
    : null;

  // Helper to generate trend data for a given range
  const generateTrendData = (rangeGames: number) => {
    return [...games]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, rangeGames)
      .reverse()
      .map((g, i) => {
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

  // Top scorers -- fmt() gives "Antonakos G." format correctly
  const topScorers = [...playersWithStats]
    .filter(p => p.stats.ppg > 0)
    .sort((a, b) => b.stats.ppg - a.stats.ppg)
    .slice(0, 5)
    .map(p => ({ name: fmt(p.name), ppg: p.stats.ppg }));

  const trend = generateTrendData(10);
  const extendedTrend = generateTrendData(trendRange);

  const recentGames = [...games]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const hasData = games.length > 0 && activePlayers.length > 0;

  return (
    <Layout title="Armani Katehano">
      {/* Hero */}
      <div style={{ position:"relative", borderRadius:16, overflow:"hidden", padding:"40px 32px", border:`1px solid ${C.border}`, background:C.surface, marginBottom:24 }}>
        <div style={{ position:"absolute", inset:0, opacity:0.18, backgroundImage:`repeating-linear-gradient(45deg,${C.red} 0,${C.red} 1px,transparent 0,transparent 50%)`, backgroundSize:"20px 20px" }} />
        <div style={{ position:"absolute", top:0, right:0, width:280, height:280, borderRadius:"50%", background:`${C.red}18`, transform:"translate(35%,-35%)" }} />
        <div style={{ position:"relative" }}>
          <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.18em", textTransform:"uppercase", color:C.redText, marginBottom:8 }}>2025-26 · Regular Season</div>
          <h1 style={{ fontSize:"clamp(36px,6vw,64px)", fontWeight:900, lineHeight:1, letterSpacing:"-0.02em", textTransform:"uppercase", color:C.text }}>
            Armani<br /><span style={{ color:C.redBright }}>Katehano</span>
          </h1>
          <p style={{ marginTop:12, fontSize:13, fontWeight:600, color:C.textSub }}>
            {record.wins}-{record.losses}
            {record.streak.count > 0 && <> · <span style={{ color:C.redText }}>{record.streak.count}-game {record.streak.type === "W" ? "win" : "loss"} streak</span></>}
            {" "}· <span style={{ color:C.redText }}>{winPct}%</span> win rate
          </p>
        </div>
      </div>

      {/* Record tiles */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:24 }}>
        <StatTile label="Record"  value={`${record.wins}-${record.losses}`} sub={`${winPct}% win rate`} />
        <StatTile label="Streak"  value={record.streak.count > 0 ? `${record.streak.count}${record.streak.type}` : "--"} sub="current streak" highlight={record.streak.type === "W" && record.streak.count > 0} />
        <StatTile label="PPG"     value={record.ppg    || "--"} sub="points per game" />
        <StatTile label="OPP PPG" value={record.oppPpg || "--"} sub="allowed per game" />
      </div>

      <ErrorBoundary label="Stats failed to load">
      {hasData && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:20 }}>

            {/* Scoring trend */}
            {trend.length > 0 && (
              <div style={{ borderRadius:16, padding:20, border:`1px solid ${C.border}`, background:C.surface, boxShadow:"0 4px 16px rgba(0,0,0,0.25)" }}>
                <div style={{ marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase" }}>Scoring Trend</div>
                    <div style={{ fontSize:18, fontWeight:700, color:C.text }}>Last {trend.length} Games</div>
                  </div>
                  <button
                    onClick={() => setShowTrendModal(true)}
                    style={{
                      fontSize:12,
                      fontWeight:700,
                      color:C.redText,
                      padding:"8px 12px",
                      borderRadius:8,
                      border:`1px solid ${C.redText}40`,
                      background:`${C.redText}08`,
                      cursor:"pointer",
                      transition:"all 0.2s ease",
                      whiteSpace:"nowrap",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${C.redText}15`;
                      e.currentTarget.style.borderColor = C.redText;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `${C.redText}08`;
                      e.currentTarget.style.borderColor = `${C.redText}40`;
                    }}
                  >Show More -></button>
                </div>
                <ResponsiveContainer width="100%" height={200}>
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
                          <div style={chartTooltipStyle.contentStyle}>
                            {game && <div style={{ color: C.textDim, fontSize:10, marginBottom:4 }}>{game}</div>}
                            {entries.map(p => (
                              <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</div>
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
              <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase" }}>Recent Results</div>
                  <Link href="/games" style={{
                    fontSize:12,
                    fontWeight:700,
                    color:C.redText,
                    padding:"8px 12px",
                    borderRadius:8,
                    border:`1px solid ${C.redText}40`,
                    background:`${C.redText}08`,
                    textDecoration:"none",
                    transition:"all 0.2s ease",
                    whiteSpace:"nowrap",
                    cursor:"pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${C.redText}15`;
                    e.currentTarget.style.borderColor = C.redText;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${C.redText}08`;
                    e.currentTarget.style.borderColor = `${C.redText}40`;
                  }}
                  >Show More -></Link>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {recentGames.map(g => (
                    <div key={g.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{
                          width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:11, fontWeight:900, flexShrink:0,
                          background: g.result==="W" ? "rgba(16,185,129,0.12)" : `${C.red}30`,
                          color: g.result==="W" ? "#6ee7b7" : C.redText,
                        }}>{g.result}</span>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{g.home ? "vs" : "@"} {g.opponent}</div>
                          <div style={{ fontSize:11, color:C.textDim }}>{fmtDate(g.date)}</div>
                        </div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{g.score}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20 }}>
            {/* Top scorers -- horizontal bars, mobile-friendly, no label overlap */}
            {topScorers.length > 0 && (
              <div
                style={{ borderRadius:16, padding:20, border:`1px solid ${C.border}`, background:C.surface, boxShadow:"0 4px 16px rgba(0,0,0,0.25)" }}
                role="img"
                aria-label="Top Scorers -- PPG"
              >
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase" }}>Top Scorers -- PPG</div>
                  <Link href="/players" style={{
                    fontSize:12,
                    fontWeight:700,
                    color:C.redText,
                    padding:"8px 12px",
                    borderRadius:8,
                    border:`1px solid ${C.redText}40`,
                    background:`${C.redText}08`,
                    textDecoration:"none",
                    transition:"all 0.2s ease",
                    whiteSpace:"nowrap",
                    cursor:"pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${C.redText}15`;
                    e.currentTarget.style.borderColor = C.redText;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${C.redText}08`;
                    e.currentTarget.style.borderColor = `${C.redText}40`;
                  }}
                  >Show More -></Link>
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
                    <Tooltip {...chartTooltipStyle} formatter={v => [`${v} PPG`]} />
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
              <div style={{ borderRadius:12, padding:20, position:"relative", overflow:"hidden", border:`1px solid ${C.redBright}40`, background:C.surface }}>
                <div style={{ position:"absolute", top:0, right:0, width:140, height:140, borderRadius:"50%", background:`${C.red}12`, transform:"translate(40%,-40%)" }} />
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, position:"relative", zIndex:1 }}>
                  <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.redText, textTransform:"uppercase" }}>⚡ Efficiency Leader</div>
                  <Link href="/players" style={{
                    fontSize:12,
                    fontWeight:700,
                    color:C.redText,
                    padding:"8px 12px",
                    borderRadius:8,
                    border:`1px solid ${C.redText}40`,
                    background:`${C.redText}08`,
                    textDecoration:"none",
                    transition:"all 0.2s ease",
                    whiteSpace:"nowrap",
                    cursor:"pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${C.redText}15`;
                    e.currentTarget.style.borderColor = C.redText;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${C.redText}08`;
                    e.currentTarget.style.borderColor = `${C.redText}40`;
                  }}
                  >Show More -></Link>
                </div>
                <div style={{ display:"flex", gap:16, alignItems:"flex-start", position:"relative", zIndex:1 }}>
                  <div style={{ width:60, height:60, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", background:C.base, border:`1px solid ${C.border2}`, flexShrink:0 }}>
                    <span style={{ fontSize:22 }}>🏀</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:900, color:C.text }}>{fmt(mvp.name)}</div>
                    <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:C.textDim, marginTop:2 }}>#{mvp.number} · {mvp.position}</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:12 }}>
                      {[
                        ["PPG", mvp.stats.ppg],
                        ["RPG", mvp.stats.rpg],
                        ["APG", mvp.stats.apg],
                        ["FG%", `${mvp.stats.fgPct}%`],
                        ["EFF", mvp.stats.eff],
                        ["MPG", mvp.stats.mpg > 0 ? fmtMinutes(mvp.stats.mpg) : "--"],
                      ].map(([l, v]) => (
                        <div key={l} style={{ textAlign:"center", borderRadius:8, padding:"8px 4px", background:C.base, border:`1px solid ${C.border}` }}>
                          <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.12em", color:C.textDim }}>{l}</div>
                          <div style={{ fontSize:13, fontWeight:900, color:C.text, marginTop:2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </ErrorBoundary>

      {!hasData && (
        <div style={{ textAlign:"center", padding:"48px 0", color:C.textDim }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏀</div>
          <div style={{ fontSize:15, fontWeight:700 }}>No data yet</div>
          <div style={{ fontSize:13, marginTop:4 }}>Add games via the admin panel to see stats here.</div>
        </div>
      )}

      {/* Upcoming Games */}
      {upcomingGames?.length > 0 && (
        <div style={{ borderRadius:16, padding:"20px 16px", border:`1px solid ${C.border}`, background:C.surface, marginBottom:24, marginTop:24, boxShadow:"0 4px 16px rgba(0,0,0,0.25)" }}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.18em", color:C.textDim, textTransform:"uppercase" }}>Schedule</div>
            <h2 style={{ fontSize:"clamp(16px,5vw,18px)", fontWeight:700, color:C.text, margin:"4px 0 0 0" }}>Upcoming Games</h2>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {upcomingGames.slice(0, 5).map((g: any) => {
              const { label, tier } = getCountdownInfo(g.scheduledFor);
              const gameTime = formatGameTime(g.scheduledFor);
              const isTodaysGame = tier === "today";
              const isWeek = tier === "week";
              const accentColor = isTodaysGame ? C.gold : isWeek ? C.redText : C.textSub;
              const venue = g.notes; // Use notes field for venue

              return (
                <div key={g.id} style={{
                  display:"flex",
                  alignItems:"flex-start",
                  justifyContent:"space-between",
                  gap:12,
                  padding:"14px 16px",
                  borderRadius:12,
                  border:`1px solid ${isTodaysGame ? `${C.gold}40` : C.border}`,
                  background: isTodaysGame ? `${C.gold}08` : "transparent",
                  transition:"all 0.2s ease",
                  cursor:"pointer",
                  transform:"translateY(0px)",
                  boxShadow:isTodaysGame ? `0 8px 16px ${C.gold}10` : "0 1px 4px rgba(0,0,0,0.1)",
                } as any}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = isTodaysGame ? `0 12px 24px ${C.gold}15` : "0 4px 12px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0px)";
                  e.currentTarget.style.boxShadow = isTodaysGame ? `0 8px 16px ${C.gold}10` : "0 1px 4px rgba(0,0,0,0.1)";
                }}>
                  {/* Left: opponent + time + competition */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
                      <div style={{ fontSize:"clamp(14px,4vw,16px)", fontWeight:800, color:C.text }}>
                        {g.location === "home" ? "vs" : "@"} {g.opponent}
                      </div>
                      <div style={{ fontSize:"clamp(12px,3vw,13px)", fontWeight:700, color:accentColor }}>
                        {gameTime}
                      </div>
                    </div>
                    {g.competition && (
                      <div style={{ fontSize:11, color:C.textDim, marginBottom:6, fontWeight:500 }}>
                        {g.competition}
                      </div>
                    )}
                    {venue && (
                      <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.textSub, marginTop:6 }}>
                        <a
                          href={`https://www.google.com/maps/search/${encodeURIComponent(venue)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display:"flex", alignItems:"center", gap:4, color:C.textSub, textDecoration:"none", transition:"color 0.2s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = C.redText)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = C.textSub)}
                        >
                          📍 {venue}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Right: countdown badge + calendar buttons */}
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8, whiteSpace:"nowrap" }}>
                    <div style={{
                      fontSize:11,
                      fontWeight:700,
                      color:accentColor,
                      padding:"6px 10px",
                      borderRadius:6,
                      background: isTodaysGame ? `${C.gold}15` : isWeek ? `${C.redText}08` : "transparent",
                      letterSpacing:"0.02em",
                    }}>
                      {label}
                    </div>
                    {/* Calendar buttons */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                      <div style={{ fontSize:10, fontWeight:600, color:C.textDim, letterSpacing:"0.03em" }}>Add to calendar</div>
                      <div style={{ display:"flex", gap:6 }}>
                        <a
                          href={getGoogleCalendarLink(g.opponent, g.scheduledFor, venue)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Add to Google Calendar"
                          style={{
                            display:"flex",
                            alignItems:"center",
                            justifyContent:"center",
                            width:28,
                            height:28,
                            borderRadius:6,
                            border:`1px solid ${C.border}`,
                            background:C.base,
                            color:C.text,
                            fontSize:13,
                            fontWeight:700,
                            textDecoration:"none",
                            transition:"all 0.2s ease",
                            cursor:"pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = C.redText;
                            e.currentTarget.style.color = C.surface;
                            e.currentTarget.style.borderColor = C.redText;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = C.base;
                            e.currentTarget.style.color = C.text;
                            e.currentTarget.style.borderColor = C.border;
                          }}
                        >
                          📅
                        </a>
                        <a
                          href={getAppleCalendarLink(g.opponent, g.scheduledFor, venue)}
                          download={`Armani-Katehano-vs-${g.opponent.replace(/\s+/g, "-")}.ics`}
                          title="Download .ics file"
                          style={{
                            display:"flex",
                            alignItems:"center",
                            justifyContent:"center",
                            width:28,
                            height:28,
                            borderRadius:6,
                            border:`1px solid ${C.border}`,
                            background:C.base,
                            color:C.text,
                            fontSize:13,
                            fontWeight:700,
                            textDecoration:"none",
                            transition:"all 0.2s ease",
                            cursor:"pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = C.redText;
                            e.currentTarget.style.color = C.surface;
                            e.currentTarget.style.borderColor = C.redText;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = C.base;
                            e.currentTarget.style.color = C.text;
                            e.currentTarget.style.borderColor = C.border;
                          }}
                        >
                          📋
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scoring Trend Modal */}
      {showTrendModal && (
        <div style={{
          position:"fixed",
          inset:0,
          backgroundColor:"rgba(0,0,0,0.5)",
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          zIndex:1000,
          padding:16,
        }}
        onClick={(e) => e.target === e.currentTarget && setShowTrendModal(false)}
        >
          <div style={{
            borderRadius:16,
            padding:32,
            background:C.surface,
            border:`1px solid ${C.border}`,
            maxWidth:"90vw",
            width:"100%",
            maxHeight:"90vh",
            display:"flex",
            flexDirection:"column",
            boxShadow:"0 20px 64px rgba(0,0,0,0.3)",
          }}>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase", marginBottom:4 }}>Scoring Trend</div>
                <div style={{ fontSize:22, fontWeight:700, color:C.text }}>Last {extendedTrend.length} Games</div>
              </div>
              <button
                onClick={() => setShowTrendModal(false)}
                style={{
                  width:40,
                  height:40,
                  borderRadius:8,
                  border:`1px solid ${C.border}`,
                  background:C.base,
                  color:C.text,
                  fontSize:20,
                  cursor:"pointer",
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  transition:"all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = C.redText;
                  e.currentTarget.style.borderColor = C.redText;
                  e.currentTarget.style.color = C.surface;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = C.base;
                  e.currentTarget.style.borderColor = C.border;
                  e.currentTarget.style.color = C.text;
                }}
              >
                ✕
              </button>
            </div>

            {/* Range selection */}
            <div style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap" }}>
              {[10, 20, 30].map(range => (
                <button
                  key={range}
                  onClick={() => setTrendRange(range)}
                  style={{
                    padding:"8px 16px",
                    borderRadius:8,
                    border:`1px solid ${trendRange === range ? C.redText : C.border}`,
                    background:trendRange === range ? `${C.redText}15` : C.base,
                    color:trendRange === range ? C.redText : C.text,
                    fontSize:13,
                    fontWeight:700,
                    cursor:"pointer",
                    transition:"all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (trendRange !== range) {
                      e.currentTarget.style.borderColor = C.redText;
                      e.currentTarget.style.background = `${C.redText}08`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (trendRange !== range) {
                      e.currentTarget.style.borderColor = C.border;
                      e.currentTarget.style.background = C.base;
                    }
                  }}
                >
                  Last {range}
                </button>
              ))}
              <button
                onClick={() => setTrendRange(games.length)}
                style={{
                  padding:"8px 16px",
                  borderRadius:8,
                  border:`1px solid ${trendRange === games.length ? C.redText : C.border}`,
                  background:trendRange === games.length ? `${C.redText}15` : C.base,
                  color:trendRange === games.length ? C.redText : C.text,
                  fontSize:13,
                  fontWeight:700,
                  cursor:"pointer",
                  transition:"all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (trendRange !== games.length) {
                    e.currentTarget.style.borderColor = C.redText;
                    e.currentTarget.style.background = `${C.redText}08`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (trendRange !== games.length) {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.background = C.base;
                  }
                }}
              >
                All Games
              </button>
            </div>

            {/* Chart */}
            <div style={{ flex:1, minHeight:0, overflow:"auto" }}>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={extendedTrend} margin={{ top:4, right:8, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="trendFillModal" x1="0" y1="0" x2="0" y2="1">
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
                        <div style={chartTooltipStyle.contentStyle}>
                          {game && <div style={{ color: C.textDim, fontSize:10, marginBottom:4 }}>{game}</div>}
                          {entries.map(p => (
                            <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="pts" stroke="none" fill="url(#trendFillModal)" legendType="none" />
                  <Line type="monotone" dataKey="pts" stroke={C.redBright} strokeWidth={3} dot={{ fill:C.redBright, r:3, strokeWidth:0 }} activeDot={{ r:5 }} name="AK" />
                  <Line type="monotone" dataKey="opp" stroke={C.silver} strokeWidth={2} dot={{ fill:C.silver, r:3, strokeWidth:0 }} activeDot={{ r:5 }} strokeDasharray="5 5" name="OPP" />
                  <Legend wrapperStyle={{ fontSize:11, color:C.textSub }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export async function getStaticProps() {
  const { players, games, stats, upcomingGames } = await getAllPublicData();
  return { props: { players, games, stats, upcomingGames }, revalidate: 300 };
}
