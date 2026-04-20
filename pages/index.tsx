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

function formatGameTime(isoStr: string): string {
  return isoStr.slice(11, 16);
}

// Generate and download .ics file with Europe/Athens timezone
function downloadIcsFile(opponent: string, isoStr: string, venue?: string): void {
  // isoStr is like "2026-04-09T17:30:00" -- already in Athens local time
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

// Ghost "Show More" -- no border, no fill; matches "BOX SCORE ->" style in games.tsx
function ShowMoreButton({ href, onClick, children, className }: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const cls = `${className ?? ""} bg-transparent border-0 text-[11px] font-bold text-ak-text-dim hover:text-ak-text-sub cursor-pointer tracking-[0.1em] uppercase transition-colors duration-150 py-1 px-0 no-underline inline-block`;
  if (href) {
    return <Link href={href} className={cls}>{children}</Link>;
  }
  return <button className={cls} onClick={onClick}>{children}</button>;
}

function ConfirmToast() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [type, setType]       = useState<"success" | "expired">("success");

  useEffect(() => {
    const { confirmed } = router.query;
    if (!confirmed) return;
    setType(confirmed === "1" ? "success" : "expired");
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 5000);
    // Strip the param from the URL so a refresh doesn't re-show it
    router.replace("/", undefined, { shallow: true });
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.confirmed]);

  if (!visible) return null;

  const isSuccess = type === "success";

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] max-w-[420px] w-[calc(100%-32px)] flex items-start gap-[10px] py-3 px-4 rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.18)] border ${
      isSuccess ? "bg-[#4caf7d18] border-[#4caf7d40]" : "bg-[#f59e0b18] border-[#f59e0b40]"
    }`}>
      <span className={`text-[15px] shrink-0 mt-0.5 ${isSuccess ? "text-ak-green" : "text-[#d97706]"}`}>
        {isSuccess ? "✓" : "⚠"}
      </span>
      <span className={`text-[13px] font-bold flex-1 leading-[1.45] ${isSuccess ? "text-ak-green" : "text-[#d97706]"}`}>
        {isSuccess
          ? "Email confirmed -- welcome to the team!"
          : "This confirmation link has expired or was already used. Please subscribe again."}
      </span>
      <button
        onClick={() => setVisible(false)}
        className={`bg-transparent border-0 cursor-pointer text-base leading-none p-0 shrink-0 opacity-70 ${isSuccess ? "text-ak-green" : "text-[#d97706]"}`}
        aria-label="Dismiss"
      >×</button>
    </div>
  );
}

// Email subscription widget
function SubscribeForm() {
  const [email,  setEmail]  = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("done");
      } else {
        const d = await res.json().catch(() => ({}));
        setErrMsg(d.error ?? "Something went wrong.");
        setStatus("error");
      }
    } catch {
      setErrMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="rounded-[14px] py-5 px-[22px] border border-ak-border bg-ak-surface mb-6">
      <div className="mb-1.5">
        <div className="text-[13px] font-black text-ak-text tracking-[0.04em]">Roster notifications</div>
        <div className="text-[11px] text-ak-text-dim mt-0.5">Get emailed when the game roster is announced</div>
      </div>
      {status === "done" ? (
        <div className="flex items-center gap-2 mt-3 py-[10px] px-[14px] rounded-lg bg-[#4caf7d14] border border-[#4caf7d35]">
          <span className="text-base">✓</span>
          <div className="text-[13px] text-ak-green font-bold">Check your email and click the confirmation link to complete your subscription.</div>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="flex gap-2 flex-wrap mt-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 min-w-[200px] py-2 px-3 text-[13px] rounded-lg border border-ak-border2 bg-ak-base text-ak-text outline-none"
            />
            <button
              type="submit"
              disabled={status === "loading" || !email}
              className={`py-2 px-[18px] rounded-lg border-0 bg-ak-red text-ak-text text-[11px] font-black tracking-[0.1em] uppercase whitespace-nowrap ${status === "loading" || !email ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
              {status === "loading" ? "Subscribing..." : "Notify me"}
            </button>
          </form>
          {status === "error" && <div className="mt-[7px] text-xs text-ak-red-text">{errMsg}</div>}
          <div className="mt-2 text-[10px] text-ak-text-dim">
            Your email is used solely for roster announcements. It is never shared with third parties and is deleted immediately when you unsubscribe. Unconfirmed addresses are removed after 24 hours.
          </div>
        </>
      )}
    </div>
  );
}

// Google Calendar icon SVG
function GoogleCalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <rect x="3" y="5" width="18" height="16" rx="2" fill="#fff" stroke="#4285F4" strokeWidth="1.5"/>
      <path d="M3 11h18" stroke="#4285F4" strokeWidth="1.5"/>
      <rect x="8" y="3" width="2" height="4" rx="1" fill="#4285F4"/>
      <rect x="14" y="3" width="2" height="4" rx="1" fill="#4285F4"/>
      <text x="12" y="20" textAnchor="middle" fill="#4285F4" fontSize="8" fontWeight="900" fontFamily="sans-serif">G</text>
    </svg>
  );
}

// Announced roster panel -- shown when visitor toggles "View Roster"
function RosterPanel({ announcement, onPlayerClick }: { announcement: any; onPlayerClick?: (id: string) => void }) {
  return (
    <div className="pt-[10px]">
      <div className="text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-2">
        Announced Roster
      </div>
      <div className="flex flex-col gap-0.5">
        {announcement.players.map((p: any) => (
          <div key={p.id} className="flex items-center gap-2 py-1 border-b border-ak-border">
            <span className="text-[11px] font-black text-ak-text-dim min-w-[28px] [font-variant-numeric:tabular-nums]">#{p.number}</span>
            <button
              type="button"
              onClick={() => onPlayerClick?.(p.id)}
              disabled={!onPlayerClick}
              className={`flex-1 text-left bg-transparent border-0 p-0 text-[13px] text-ak-text transition-colors duration-150 ${onPlayerClick ? "cursor-pointer hover:text-ak-red-text" : "cursor-default"}`}
            >
              {p.name}
            </button>
            <span className="text-[10px] text-ak-text-dim">{p.position}</span>
            {p.note && (
              <span className="text-[9px] font-black tracking-[0.08em] px-1.5 py-0.5 rounded bg-[#4caf7d20] text-ak-green border border-[#4caf7d40] whitespace-nowrap">
                {p.note}
              </span>
            )}
          </div>
        ))}
      </div>
      {announcement.message && (
        <div className="mt-[10px] py-2 px-3 rounded-lg bg-ak-surface2 text-xs text-ak-text-sub italic leading-relaxed">
          &ldquo;{announcement.message}&rdquo;
        </div>
      )}
    </div>
  );
}

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

  // Top scorers -- full player objects sorted by PPG
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
                        : `View Roster (${featured.announcement.players.length} players) ->`}
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
                            {g.announcement ? (rosterOpen ? "↑" : `${g.announcement.players.length}`) : "--"}
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

                {/* Show More -- ghost style, matches "BOX SCORE ->" in games.tsx */}
                {!showAllUpcoming && rest.length > 3 && (
                  <div className="text-center pt-1">
                    <ShowMoreButton onClick={() => setShowAllUpcoming(true)}>
                      {rest.length - 3} more game{rest.length - 3 !== 1 ? "s" : ""} ->
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
                  <ShowMoreButton className="show-more-btn" onClick={() => setShowTrendModal(true)}>Show More -></ShowMoreButton>
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
                  <ShowMoreButton href="/games" className="show-more-btn">All Games -></ShowMoreButton>
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
                aria-label="Top Scorers -- PPG"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase">Top Scorers -- PPG</div>
                  <ShowMoreButton href="/players" className="show-more-btn">All Players -></ShowMoreButton>
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
                  <ShowMoreButton href="/players" className="show-more-btn">All Players -></ShowMoreButton>
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
                    ["MPG", mvp.stats.mpg > 0 ? fmtMinutes(mvp.stats.mpg) : "--"],
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

      {/* Scoring Trend Modal */}
      {showTrendModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4 trend-modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setShowTrendModal(false)}
        >
          <div className="rounded-2xl p-[clamp(16px,4vw,32px)] bg-ak-surface border border-ak-border max-w-[95vw] w-full max-h-[90vh] flex flex-col shadow-[0_20px_64px_rgba(0,0,0,0.3)] min-h-0 trend-modal-content">
            {/* Header */}
            <div className="flex items-start justify-between mb-[clamp(16px,3vw,24px)] gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-1">Scoring Trend</div>
                <div className="text-[clamp(18px,5vw,22px)] font-bold text-ak-text">Last {extendedTrend.length} Games</div>
              </div>
              <button
                onClick={() => setShowTrendModal(false)}
                className="w-[clamp(32px,8vw,40px)] h-[clamp(32px,8vw,40px)] min-w-8 min-h-8 rounded-lg border border-ak-border bg-ak-base text-ak-text text-[clamp(16px,4vw,20px)] cursor-pointer flex items-center justify-center transition-all duration-200 shrink-0 hover:bg-ak-red-text hover:border-ak-red-text hover:text-ak-surface"
              >
                ✕
              </button>
            </div>

            {/* Range selection */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(70px,1fr))] gap-2 mb-[clamp(16px,3vw,24px)] trend-buttons">
              {[10, 20, 30].map(range => (
                <button
                  key={range}
                  onClick={() => setTrendRange(range)}
                  className={`py-[clamp(6px,2vw,8px)] px-[clamp(12px,3vw,16px)] rounded-lg border text-[clamp(11px,2.5vw,13px)] font-bold cursor-pointer transition-all duration-200 ${
                    trendRange === range
                      ? "border-ak-red-text bg-[#e0555515] text-ak-red-text"
                      : "border-ak-border bg-ak-base text-ak-text hover:border-ak-red-text hover:bg-[#e0555508]"
                  }`}
                >
                  Last {range}
                </button>
              ))}
              <button
                onClick={() => setTrendRange(games.length)}
                className={`py-[clamp(6px,2vw,8px)] px-[clamp(12px,3vw,16px)] rounded-lg border text-[clamp(11px,2.5vw,13px)] font-bold cursor-pointer transition-all duration-200 ${
                  trendRange === games.length
                    ? "border-ak-red-text bg-[#e0555515] text-ak-red-text"
                    : "border-ak-border bg-ak-base text-ak-text hover:border-ak-red-text hover:bg-[#e0555508]"
                }`}
              >
                All Games
              </button>
            </div>

            {/* Chart */}
            <div className="h-[clamp(250px,50vh,500px)] overflow-x-auto overflow-y-hidden -mr-2 pr-2">
              <div className="min-w-[500px] h-full">
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
                        <div className="bg-ak-surface2 border border-ak-border2 rounded-lg text-xs text-ak-text">
                          {game && <div className="text-[10px] text-ak-text-dim mb-1">{game}</div>}
                          {entries.map(p => (
                            <div key={p.name} className={p.name === "AK" ? "text-ak-red-bright" : "text-ak-silver"}>{p.name}: {p.value}</div>
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
