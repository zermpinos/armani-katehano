import { useState } from "react";
import Layout from "../components/Layout";
import { StatTile, SectionHeading } from "../components/ui";
import { C, chartTooltipStyle } from "../lib/theme";
import { getAllPublicData, getUpcomingGamesWithAnnouncements } from "../lib/data";
import { computeRecord } from "../lib/stats";
import { fmt, fmtDate, fmtMinutes } from "../lib/utils";
import ErrorBoundary from "../components/ErrorBoundary";
import { LineChart, Line, BarChart, Bar, Cell, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "../components/Charts";
import Link from "next/link";

// Countdown badge logic — determines tier and label for upcoming games
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

// Generate and download .ics file with Europe/Athens timezone
function downloadIcsFile(opponent: string, isoStr: string, venue?: string): void {
  // isoStr is like "2026-04-09T17:30:00" — already in Athens local time
  const dtStart = isoStr.replace(/[-:]/g, "").split(".")[0];
  // Add 1 hour for end time
  const [datePart, timePart] = isoStr.split("T");
  const [hh, mm, ss] = timePart.split(":");
  const endHH = String(parseInt(hh) + 1).padStart(2, "0");
  const dtEnd = `${datePart.replace(/-/g, "")}T${endHH}${mm}${ss || "00"}`;

  const title = `Armani Katehano vs ${opponent}`;
  const description = venue ? `Venue: ${venue}` : "Game";
  const uid = `${dtStart}-${opponent.replace(/\s+/g, "")}@armanikatehano`;

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Armani Katehano//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Athens",
    "BEGIN:STANDARD",
    "DTSTART:19701025T040000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "TZOFFSETFROM:+0300",
    "TZOFFSETTO:+0200",
    "TZNAME:EET",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700329T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0300",
    "TZNAME:EEST",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `DTSTART;TZID=Europe/Athens:${dtStart}`,
    `DTEND;TZID=Europe/Athens:${dtEnd}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    venue ? `LOCATION:${venue}` : "",
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  const blob = new Blob([ical], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Armani-Katehano-vs-${opponent.replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Build a Google Calendar "Add to Calendar" URL for a game
function buildGoogleCalendarUrl(opponent: string, isoStr: string, venue?: string): string {
  const dtStart = isoStr.replace(/[-:]/g, "").split(".")[0];
  const [datePart, timePart] = isoStr.split("T");
  const [hh, mm] = timePart.split(":");
  const endHH = String(parseInt(hh) + 1).padStart(2, "0");
  const dtEnd = `${datePart.replace(/-/g, "")}T${endHH}${mm}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Armani Katehano vs ${opponent}`,
    dates: `${dtStart}/${dtEnd}`,
    ctz: "Europe/Athens",
    ...(venue ? { location: venue, details: `Venue: ${venue}` } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// Ghost "Show More" — no border, no fill; matches "BOX SCORE →" style in games.tsx
function ShowMoreButton({ href, onClick, children, className }: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const style: React.CSSProperties = {
    background: "none",
    border: "none",
    fontSize: 11,
    fontWeight: 700,
    color: C.textDim,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    transition: "color 0.15s",
    padding: "4px 0",
    textDecoration: "none",
    display: "inline-block",
  };
  const onEnter = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.color = C.textSub; };
  const onLeave = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.color = C.textDim; };
  if (href) {
    return (
      <Link href={href} className={className} style={style} onMouseEnter={onEnter} onMouseLeave={onLeave}>
        {children}
      </Link>
    );
  }
  return (
    <button className={className} style={style} onClick={onClick} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
    </button>
  );
}

// Announced roster panel — shown when visitor toggles "View Roster"
function RosterPanel({ announcement }: { announcement: any }) {
  return (
    <div style={{ paddingTop: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, textTransform: "uppercase", marginBottom: 8 }}>
        Announced Roster
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {announcement.players.map((p: any) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: C.textDim, minWidth: 28, fontVariantNumeric: "tabular-nums" }}>#{p.number}</span>
            <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{p.name}</span>
            <span style={{ fontSize: 10, color: C.textDim }}>{p.position}</span>
            {p.note && (
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", padding: "2px 6px", borderRadius: 4, background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}40`, whiteSpace: "nowrap" }}>
                {p.note}
              </span>
            )}
          </div>
        ))}
      </div>
      {announcement.message && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: C.surface2, fontSize: 12, color: C.textSub, fontStyle: "italic", lineHeight: 1.5 }}>
          "{announcement.message}"
        </div>
      )}
    </div>
  );
}

// Google Calendar icon SVG
function GoogleCalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect x="3" y="5" width="18" height="16" rx="2" fill="#fff" stroke="#4285F4" strokeWidth="1.5"/>
      <path d="M3 11h18" stroke="#4285F4" strokeWidth="1.5"/>
      <rect x="8" y="3" width="2" height="4" rx="1" fill="#4285F4"/>
      <rect x="14" y="3" width="2" height="4" rx="1" fill="#4285F4"/>
      <text x="12" y="20" textAnchor="middle" fill="#4285F4" fontSize="8" fontWeight="900" fontFamily="sans-serif">G</text>
    </svg>
  );
}

export default function HomePage({ players, games, stats, upcomingGames }: any) {
  const [trendRange, setTrendRange] = useState(10);
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [openRosterId, setOpenRosterId] = useState<string | null>(null);
  const toggleRoster = (id: string) => setOpenRosterId(prev => prev === id ? null : id);

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

  // Top scorers — full player objects sorted by PPG
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
      {/* Hero */}
      <div style={{ position:"relative", borderRadius:16, overflow:"hidden", padding:"40px 32px", border:`1px solid ${C.border}`, background:C.surface, marginBottom:24 }}>
        <div style={{ position:"absolute", inset:0, opacity:0.18, backgroundImage:`repeating-linear-gradient(45deg,${C.red} 0,${C.red} 1px,transparent 0,transparent 50%)`, backgroundSize:"20px 20px" }} />
        <div style={{ position:"absolute", top:0, right:0, width:280, height:280, borderRadius:"50%", background:`${C.red}18`, transform:"translate(35%,-35%)" }} />
        <div style={{ position:"relative" }}>
          <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.18em", textTransform:"uppercase", color:C.redText, marginBottom:8 }}>2025–26 · Regular Season</div>
          <h1 style={{ fontSize:"clamp(36px,6vw,64px)", fontWeight:900, lineHeight:1, letterSpacing:"-0.02em", textTransform:"uppercase", color:C.text }}>
            Armani<br /><span style={{ color:C.redBright }}>Katehano</span>
          </h1>
          <p style={{ marginTop:12, fontSize:13, fontWeight:600, color:C.textSub }}>
            {record.wins}–{record.losses}
            {record.streak.count > 0 && <> · <span style={{ color:C.redText }}>{record.streak.count}-game {record.streak.type === "W" ? "win" : "loss"} streak</span></>}
            {" "}· <span style={{ color:C.redText }}>{winPct}%</span> win rate
          </p>
        </div>
      </div>

      {/* Record tiles */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:24 }}>
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
        const featAccent = isToday ? C.gold : isWeek ? C.redText : C.textSub;
        const featVenue  = featured.notes;

        return (
          <div style={{ borderRadius:16, padding:"20px 16px", border:`1px solid ${C.border}`, background:C.surface, marginBottom:24, boxShadow:"0 4px 16px rgba(0,0,0,0.25)" }}>
            {/* Section header */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.18em", color:C.textDim, textTransform:"uppercase" }}>Schedule</div>
              <h2 style={{ fontSize:"clamp(16px,5vw,18px)", fontWeight:700, color:C.text, margin:"4px 0 0 0" }}>Upcoming Games</h2>
            </div>

            {/* ── Featured card: next game ── */}
            <div style={{
              borderRadius:14,
              padding:"18px 20px",
              border:`1px solid ${isToday ? `${C.gold}55` : isWeek ? `${C.redText}35` : C.border2}`,
              background: isToday ? `${C.gold}0d` : isWeek ? `${C.redText}08` : C.surface2,
              marginBottom: rest.length > 0 ? 10 : 0,
              boxShadow: isToday ? `0 8px 24px ${C.gold}18` : isWeek ? `0 4px 16px ${C.redText}12` : "0 2px 8px rgba(0,0,0,0.18)",
            }}>
              {/* Top label */}
              <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.18em", textTransform:"uppercase", color: isToday ? C.gold : C.redText, marginBottom:12 }}>
                {isToday ? "⚡ Today" : "Next Game"}
              </div>
              {/* Main row: left info | right badge + buttons */}
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
                {/* Left */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <div style={{ fontSize:"clamp(18px,5vw,24px)", fontWeight:900, color:C.text, lineHeight:1.15 }}>
                      {featured.location === "home" ? "vs" : "@"} {featured.opponent}
                    </div>
                    <div style={{ fontSize:"clamp(13px,3vw,15px)", fontWeight:700, color:featAccent }}>{featTime}</div>
                  </div>
                  {featured.competition && (
                    <div style={{ fontSize:12, color:C.textDim, fontWeight:500, marginBottom:4 }}>{featured.competition}</div>
                  )}
                  {featVenue && (
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(featVenue)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, color:C.textSub, textDecoration:"none", transition:"color 0.2s", marginTop:2 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = C.redText)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = C.textSub)}
                    >
                      📍 {featVenue}
                    </a>
                  )}
                </div>
                {/* Right: badge + calendar buttons side by side */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8, flexShrink:0 }}>
                  <div style={{
                    fontSize:11, fontWeight:700, color:featAccent,
                    padding:"3px 10px", borderRadius:20,
                    background: isToday ? `${C.gold}20` : isWeek ? `${C.redText}12` : `${C.textSub}10`,
                    letterSpacing:"0.03em", whiteSpace:"nowrap",
                  }}>
                    {featLabel}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    {/* Google Calendar */}
                    <a
                      href={buildGoogleCalendarUrl(featured.opponent, featured.scheduledFor, featVenue)}
                      target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display:"inline-flex", alignItems:"center", gap:6,
                        padding:"7px 12px", borderRadius:8,
                        border:"1px solid #4285F440", background:"#4285F410", color:"#4285F4",
                        fontSize:11, fontWeight:700, textDecoration:"none",
                        cursor:"pointer", transition:"all 0.2s ease", whiteSpace:"nowrap",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background="#4285F420"; e.currentTarget.style.borderColor="#4285F465"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background="#4285F410"; e.currentTarget.style.borderColor="#4285F440"; }}
                    >
                      <GoogleCalIcon />
                      Google
                    </a>
                    {/* Download .ics */}
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadIcsFile(featured.opponent, featured.scheduledFor, featVenue); }}
                      style={{
                        display:"inline-flex", alignItems:"center", gap:6,
                        padding:"7px 12px", borderRadius:8,
                        border:`1px solid ${C.border2}`, background:C.base, color:C.textSub,
                        fontSize:11, fontWeight:700, cursor:"pointer",
                        transition:"all 0.2s ease", fontFamily:"inherit", whiteSpace:"nowrap",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color=C.text; e.currentTarget.style.borderColor=C.border2; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color=C.textSub; e.currentTarget.style.borderColor=C.border2; }}
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
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                {featured.announcement ? (
                  <>
                    <button
                      onClick={() => toggleRoster(featured.id)}
                      style={{ background: "none", border: "none", fontSize: 11, fontWeight: 700, color: C.textDim, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 0", display: "flex", alignItems: "center", gap: 6 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.textSub; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.textDim; }}
                    >
                      {openRosterId === featured.id
                        ? "Hide Roster ↑"
                        : `View Roster (${featured.announcement.players.length} players) →`}
                    </button>
                    {openRosterId === featured.id && <RosterPanel announcement={featured.announcement} />}
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: C.textDim, letterSpacing: "0.04em" }}>Roster TBA</div>
                )}
              </div>
            </div>

            {/* ── Compact cards: remaining games ── */}
            {rest.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                {(showAllUpcoming ? rest : rest.slice(0, 3)).map((g: any) => {
                  const { label, tier } = getCountdownInfo(g.scheduledFor);
                  const gameTime = formatGameTime(g.scheduledFor);
                  const accentColor = tier === "today" ? C.gold : tier === "week" ? C.redText : C.textSub;
                  const venue = g.notes;
                  const rosterOpen = openRosterId === g.id;
                  return (
                    <div key={g.id}>
                      <div style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between", gap:10,
                        padding:"10px 14px", borderRadius: rosterOpen ? "10px 10px 0 0" : 10,
                        border:`1px solid ${rosterOpen ? `${C.green}40` : C.border}`,
                        background:"transparent",
                        transition:"background 0.15s ease, border-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.surface2; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        {/* Left: info */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap" }}>
                            <span style={{ fontSize:13, fontWeight:700, color:C.text }}>
                              {g.location === "home" ? "vs" : "@"} {g.opponent}
                            </span>
                            <span style={{ fontSize:11, fontWeight:600, color:accentColor }}>{gameTime}</span>
                            {g.competition && (
                              <span style={{ fontSize:11, color:C.textDim }}>· {g.competition}</span>
                            )}
                          </div>
                          <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{label}</div>
                        </div>
                        {/* Right: icon-only buttons + roster toggle */}
                        <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                          <a
                            href={buildGoogleCalendarUrl(g.opponent, g.scheduledFor, venue)}
                            target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Add to Google Calendar"
                            style={{
                              display:"flex", alignItems:"center", justifyContent:"center",
                              width:28, height:28, borderRadius:7,
                              border:`1px solid ${C.border}`,
                              background:C.base,
                              textDecoration:"none",
                              transition:"all 0.15s ease",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor="#4285F4"; e.currentTarget.style.background="#4285F412"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.background=C.base; }}
                          >
                            <GoogleCalIcon />
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadIcsFile(g.opponent, g.scheduledFor, venue); }}
                            title="Download .ics"
                            style={{
                              display:"flex", alignItems:"center", justifyContent:"center",
                              width:28, height:28, borderRadius:7,
                              border:`1px solid ${C.border}`,
                              background:C.base,
                              color:C.textDim,
                              cursor:"pointer",
                              transition:"all 0.15s ease",
                              fontFamily:"inherit",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor=C.border2; e.currentTarget.style.color=C.textSub; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textDim; }}
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
                            style={{
                              display:"flex", alignItems:"center", justifyContent:"center",
                              width:28, height:28, borderRadius:7,
                              border:`1px solid ${rosterOpen ? `${C.green}60` : C.border}`,
                              background: rosterOpen ? `${C.green}15` : C.base,
                              color: g.announcement ? (rosterOpen ? C.green : C.textDim) : C.textDim,
                              cursor: g.announcement ? "pointer" : "default",
                              transition:"all 0.15s ease",
                              fontFamily:"inherit",
                              fontSize: 10, fontWeight: 900, letterSpacing: "0.05em",
                              opacity: g.announcement ? 1 : 0.4,
                            }}
                            onMouseEnter={(e) => { if (g.announcement && !rosterOpen) { e.currentTarget.style.borderColor=C.border2; e.currentTarget.style.color=C.textSub; } }}
                            onMouseLeave={(e) => { if (g.announcement && !rosterOpen) { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textDim; } }}
                          >
                            {g.announcement ? (rosterOpen ? "↑" : `${g.announcement.players.length}`) : "—"}
                          </button>
                        </div>
                      </div>
                      {rosterOpen && g.announcement && (
                        <div style={{ padding:"10px 14px 12px", border:`1px solid ${C.green}40`, borderTop:"none", borderRadius:"0 0 10px 10px", background:`${C.green}05` }}>
                          <RosterPanel announcement={g.announcement} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Show More — ghost style, matches "BOX SCORE →" in games.tsx */}
                {!showAllUpcoming && rest.length > 3 && (
                  <div style={{ textAlign:"center", paddingTop:4 }}>
                    <button
                      onClick={() => setShowAllUpcoming(true)}
                      style={{
                        background:"none", border:"none",
                        fontSize:11, fontWeight:700,
                        color:C.textDim,
                        cursor:"pointer",
                        fontFamily:"inherit",
                        letterSpacing:"0.1em",
                        textTransform:"uppercase",
                        transition:"color 0.15s",
                        padding:"4px 0",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = C.textSub; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = C.textDim; }}
                    >
                      {rest.length - 3} more game{rest.length - 3 !== 1 ? "s" : ""} →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      <ErrorBoundary label="Stats failed to load">
      {hasData && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:20 }}>

            {/* Scoring trend */}
            {trend.length > 0 && (
              <div style={{ borderRadius:16, padding:20, border:`1px solid ${C.border}`, background:C.surface, boxShadow:"0 4px 16px rgba(0,0,0,0.25)", display:"flex", flexDirection:"column", minHeight:320 }}>
                <div style={{ marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase" }}>Scoring Trend</div>
                    <div style={{ fontSize:18, fontWeight:700, color:C.text }}>Last {trend.length} Games</div>
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
              <div style={{ borderRadius:16, padding:20, border:`1px solid ${C.border}`, background:C.surface, boxShadow:"0 4px 16px rgba(0,0,0,0.25)" }}>
                <div style={{ marginBottom:14, display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase" }}>Recent Results</div>
                    <div style={{ fontSize:18, fontWeight:700, color:C.text, marginTop:2 }}>Last {recentGames.length} Games</div>
                  </div>
                  <ShowMoreButton href="/games" className="show-more-btn">All Games →</ShowMoreButton>
                </div>

                {/* Featured: most recent game */}
                {(() => {
                  const g = recentGames[0];
                  const isWin = g.result === "W";
                  return (
                    <div style={{
                      borderRadius:12, padding:"14px 16px", marginBottom:8,
                      border:`1px solid ${isWin ? `${C.green}30` : `${C.redText}25`}`,
                      background: isWin ? "rgba(16,185,129,0.06)" : `${C.red}08`,
                      display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <span style={{
                          width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:13, fontWeight:900, flexShrink:0,
                          background: isWin ? "rgba(16,185,129,0.15)" : `${C.red}35`,
                          color: isWin ? "#6ee7b7" : C.redText,
                          border:`1px solid ${isWin ? "rgba(16,185,129,0.25)" : `${C.redText}30`}`,
                        }}>{g.result}</span>
                        <div>
                          <div style={{ fontSize:15, fontWeight:800, color:C.text }}>{g.home ? "vs" : "@"} {g.opponent}</div>
                          <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{fmtDate(g.date)}</div>
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontSize:20, fontWeight:900, color: isWin ? C.green : C.redText }}>{g.score}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Compact: remaining games */}
                <div style={{ display:"flex", flexDirection:"column" }}>
                  {recentGames.slice(1).map((g, i) => {
                    const isWin = g.result === "W";
                    return (
                      <div key={g.id} style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between", gap:10,
                        padding:"9px 4px",
                        borderTop: i === 0 ? `1px solid ${C.border}` : `1px solid ${C.border}`,
                      }}>
                        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                          <span style={{
                            width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:10, fontWeight:900, flexShrink:0,
                            background: isWin ? "rgba(16,185,129,0.10)" : `${C.red}25`,
                            color: isWin ? "#6ee7b7" : C.redText,
                          }}>{g.result}</span>
                          <div>
                            <div style={{ fontSize:12, fontWeight:600, color:C.textSub }}>{g.home ? "vs" : "@"} {g.opponent}</div>
                            <div style={{ fontSize:10, color:C.textDim }}>{fmtDate(g.date)}</div>
                          </div>
                        </div>
                        <div style={{ fontSize:12, fontWeight:700, color:C.textSub }}>{g.score}</div>
                      </div>
                    );
                  })}
                </div>

              </div>
            )}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20 }}>
            {/* Top scorers */}
            {topScorers.length > 0 && (
              <div
                style={{ borderRadius:16, padding:20, border:`1px solid ${C.border}`, background:C.surface, boxShadow:"0 4px 16px rgba(0,0,0,0.25)" }}
                role="img"
                aria-label="Top Scorers — PPG"
              >
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase" }}>Top Scorers — PPG</div>
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
              <div style={{ borderRadius:16, padding:20, position:"relative", overflow:"hidden", border:`0.5px solid ${C.redBright}35`, background:C.surface, boxShadow:"0 1px 1px rgba(0,0,0,0.25)" }}>
                <div style={{ position:"absolute", top:0, right:0, width:140, height:140, borderRadius:"50%", background:`${C.red}12`, transform:"translate(40%,-40%)" }} />
                {/* Header */}
                <div style={{ marginBottom:14, position:"relative", zIndex:1, display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.redText, textTransform:"uppercase" }}>⚡ Efficiency Leader</div>
                  </div>
                  <ShowMoreButton href="/players" className="show-more-btn">All Players →</ShowMoreButton>
                </div>
                {/* Featured player */}
                <div style={{
                  borderRadius:12, padding:"14px 16px", marginBottom:12,
                  border:`1px solid ${C.redText}25`, background:`${C.red}08`,
                  display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
                  position:"relative", zIndex:1,
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", background:`${C.red}20`, border:`1px solid ${C.redText}30`, flexShrink:0, fontSize:16 }}>
                      🏀
                    </div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:C.text }}>{fmt(mvp.name)}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:C.textDim, marginTop:2 }}>#{mvp.number} · {mvp.position}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:22, fontWeight:900, color:C.redText }}>{mvp.stats.eff}</div>
                    <div style={{ fontSize:10, fontWeight:700, color:C.textDim, letterSpacing:"0.1em" }}>EFF</div>
                  </div>
                </div>
                {/* Stat grid */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, position:"relative", zIndex:1 }}>
                  {[
                    ["PPG", mvp.stats.ppg],
                    ["RPG", mvp.stats.rpg],
                    ["APG", mvp.stats.apg],
                    ["FG%", `${mvp.stats.fgPct}%`],
                    ["GP",  mvp.stats.gp],
                    ["MPG", mvp.stats.mpg > 0 ? fmtMinutes(mvp.stats.mpg) : "—"],
                  ].map(([l, v]) => (
                    <div key={l} style={{ textAlign:"center", borderRadius:8, padding:"8px 4px", background:C.base, border:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.12em", color:C.textDim }}>{l}</div>
                      <div style={{ fontSize:13, fontWeight:900, color:C.text, marginTop:2 }}>{v}</div>
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
        <div style={{ textAlign:"center", padding:"48px 0", color:C.textDim }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏀</div>
          <div style={{ fontSize:15, fontWeight:700 }}>No data yet</div>
          <div style={{ fontSize:13, marginTop:4 }}>Add games via the admin panel to see stats here.</div>
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
          padding:"16px",
        }}
        onClick={(e) => e.target === e.currentTarget && setShowTrendModal(false)}
        className="trend-modal-backdrop"
        >
          <div style={{
            borderRadius:16,
            padding:"clamp(16px, 4vw, 32px)",
            background:C.surface,
            border:`1px solid ${C.border}`,
            maxWidth:"95vw",
            width:"100%",
            maxHeight:"90vh",
            display:"flex",
            flexDirection:"column",
            boxShadow:"0 20px 64px rgba(0,0,0,0.3)",
            minHeight:0,
          }} className="trend-modal-content">
            {/* Header */}
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"clamp(16px, 3vw, 24px)", gap:16 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase", marginBottom:4 }}>Scoring Trend</div>
                <div style={{ fontSize:"clamp(18px, 5vw, 22px)", fontWeight:700, color:C.text }}>Last {extendedTrend.length} Games</div>
              </div>
              <button
                onClick={() => setShowTrendModal(false)}
                style={{
                  width:"clamp(32px, 8vw, 40px)",
                  height:"clamp(32px, 8vw, 40px)",
                  minWidth:32,
                  minHeight:32,
                  borderRadius:8,
                  border:`1px solid ${C.border}`,
                  background:C.base,
                  color:C.text,
                  fontSize:"clamp(16px, 4vw, 20px)",
                  cursor:"pointer",
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  transition:"all 0.2s ease",
                  flexShrink:0,
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
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(70px, 1fr))", gap:"8px", marginBottom:"clamp(16px, 3vw, 24px)" }} className="trend-buttons">
              {[10, 20, 30].map(range => (
                <button
                  key={range}
                  onClick={() => setTrendRange(range)}
                  style={{
                    padding:"clamp(6px, 2vw, 8px) clamp(12px, 3vw, 16px)",
                    borderRadius:8,
                    border:`1px solid ${trendRange === range ? C.redText : C.border}`,
                    background:trendRange === range ? `${C.redText}15` : C.base,
                    color:trendRange === range ? C.redText : C.text,
                    fontSize:"clamp(11px, 2.5vw, 13px)",
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
                  padding:"clamp(6px, 2vw, 8px) clamp(12px, 3vw, 16px)",
                  borderRadius:8,
                  border:`1px solid ${trendRange === games.length ? C.redText : C.border}`,
                  background:trendRange === games.length ? `${C.redText}15` : C.base,
                  color:trendRange === games.length ? C.redText : C.text,
                  fontSize:"clamp(11px, 2.5vw, 13px)",
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
            <div style={{ height:"clamp(250px, 50vh, 500px)", overflowX:"auto", overflowY:"hidden", marginRight:"-8px", paddingRight:"8px" }}>
              <div style={{ minWidth:500, height:"100%" }}>
              <ResponsiveContainer width="100%" height="100%">
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
        </div>
      )}

      </Layout>
  );
}

export async function getStaticProps() {
  const [{ players, games, stats }, upcomingGames] = await Promise.all([
    getAllPublicData(),
    getUpcomingGamesWithAnnouncements(),
  ]);
  return { props: { players, games, stats, upcomingGames }, revalidate: 300 };
}
