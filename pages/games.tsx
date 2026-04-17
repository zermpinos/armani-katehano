import { useState, useMemo, useEffect, memo } from "react";
import Layout from "../components/Layout";
import { SectionHeading } from "../components/ui";
import SeasonSelector from "../components/SeasonSelector";
import { C } from "../lib/theme";
import { getAllGames, getPlayers, getSeasons, getConfig, getAllUpcomingGames, getAllSeasonsStats } from "../lib/data";
import { buildAllTimeStatsMap } from "../lib/stats";
import ErrorBoundary from "../components/ErrorBoundary";
import { fmt, fmtMinutes } from "../lib/utils";
import { getVenueUrl } from "../lib/venues";
import { PlayerDetail } from "../components/PlayerDetail";

// ── Upcoming-game helpers (mirrored from index.tsx) ──────────────────────────

function getCountdownInfo(isoStr: string): { label: string; tier: "today" | "week" | "future" } {
  const now = new Date();
  const gameTime = new Date(isoStr);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const gameDay = new Date(gameTime.getFullYear(), gameTime.getMonth(), gameTime.getDate());
  const daysUntil = Math.ceil((gameDay.getTime() - todayStart.getTime()) / 86400000);
  const fmtTime = () => isoStr.slice(11, 16);
  if (daysUntil === 0) return { label: `Today at ${fmtTime()}`, tier: "today" };
  if (daysUntil === 1) return { label: `Tomorrow at ${fmtTime()}`, tier: "week" };
  if (daysUntil <= 6)  return { label: `In ${daysUntil} days`, tier: "week" };
  return { label: isoStr.slice(0, 10), tier: "future" };
}

function formatGameTime(isoStr: string): string {
  return isoStr.slice(11, 16);
}

function downloadIcsFile(opponent: string, isoStr: string, venue?: string): void {
  const dtStart = isoStr.replace(/[-:]/g, "").split(".")[0];
  const [datePart, timePart] = isoStr.split("T");
  const [hh, mm, ss] = timePart.split(":");
  const endHH = String(parseInt(hh) + 1).padStart(2, "0");
  const dtEnd = `${datePart.replace(/-/g, "")}T${endHH}${mm}${ss || "00"}`;
  const title = `Armani Katehano vs ${opponent}`;
  const description = venue ? `Venue: ${venue}` : "Game";
  const uid = `${dtStart}-${opponent.replace(/\s+/g, "")}@armanikatehano`;
  const ical = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Armani Katehano//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE", "TZID:Europe/Athens",
    "BEGIN:STANDARD", "DTSTART:19701025T040000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "TZOFFSETFROM:+0300", "TZOFFSETTO:+0200", "TZNAME:EET", "END:STANDARD",
    "BEGIN:DAYLIGHT", "DTSTART:19700329T030000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "TZOFFSETFROM:+0200", "TZOFFSETTO:+0300", "TZNAME:EEST", "END:DAYLIGHT",
    "END:VTIMEZONE", "BEGIN:VEVENT",
    `DTSTART;TZID=Europe/Athens:${dtStart}`, `DTEND;TZID=Europe/Athens:${dtEnd}`,
    `SUMMARY:${title}`, `DESCRIPTION:${description}`,
    venue ? `LOCATION:${venue}` : "",
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    "END:VEVENT", "END:VCALENDAR",
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

function UpcomingGameModal({ game, onClose }: any) {
  const { label, tier } = getCountdownInfo(game.scheduledFor);
  const gameTime = formatGameTime(game.scheduledFor);
  const venue = game.notes;
  const accentColor = tier === "today" ? C.gold : tier === "week" ? C.redText : C.textSub;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        style={{ background:C.surface, borderRadius:16, padding:24, maxWidth:360, width:"100%", border:`1px solid ${C.border2}`, boxShadow:"0 8px 32px rgba(0,0,0,0.4)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.18em", textTransform:"uppercase", color:accentColor, marginBottom:6 }}>
              {tier === "today" ? "⚡ Today" : "Upcoming"}
            </div>
            <div style={{ fontSize:20, fontWeight:900, color:C.text, lineHeight:1.2 }}>
              {game.location === "home" ? "vs" : "@"} {game.opponent}
            </div>
            {game.competition && (
              <div style={{ fontSize:12, color:C.textDim, marginTop:4 }}>{game.competition}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.textDim, fontSize:24, cursor:"pointer", fontWeight:900, padding:"0 0 0 12px", lineHeight:1 }}>×</button>
        </div>

        {/* Date / time / venue row */}
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:accentColor }}>{label}</span>
            <span style={{ fontSize:13, fontWeight:700, color:C.textSub }}>· {gameTime}</span>
          </div>
          {venue && (
            <a
              href={getVenueUrl(venue)}
              target="_blank" rel="noopener noreferrer"
              style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, color:C.textSub, textDecoration:"none" }}
            >
              📍 {venue}
            </a>
          )}
        </div>

        {/* Calendar buttons */}
        <div style={{ display:"flex", gap:8 }}>
          <a
            href={buildGoogleCalendarUrl(game.opponent, game.scheduledFor, venue)}
            target="_blank" rel="noopener noreferrer"
            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px 12px", borderRadius:8, border:"1px solid #4285F440", background:"#4285F410", color:"#4285F4", fontSize:12, fontWeight:700, textDecoration:"none" }}
          >
            <GoogleCalIcon /> Google
          </a>
          <button
            onClick={() => downloadIcsFile(game.opponent, game.scheduledFor, venue)}
            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px 12px", borderRadius:8, border:`1px solid ${C.border2}`, background:C.base, color:C.textSub, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
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
  );
}

const BOX_COLS = [
  {key:"min",label:"MIN"},
  {key:"pts",label:"PTS"},
  {key:"reb",label:"REB"},
  {key:"ast",label:"AST"},
  {key:"stl",label:"STL"},
  {key:"blk",label:"BLK"},
  {key:"tov",label:"TOV"},
  {key:"fgm",label:"FGM"},
  {key:"fga",label:"FGA"},
  {key:"fg3m",label:"3PM"},
  {key:"fg3a",label:"3PA"},
  {key:"ftm",label:"FTM"},
  {key:"fta",label:"FTA"},
  {key:"eff",label:"EFF"},
];

function formatTopScorer(topScorer: any) {
  if (!topScorer || !topScorer.pts) return null;
  return `${fmt(topScorer.name)} ${topScorer.pts} PTS`;
}

const BoxScore = memo(function BoxScore({ game, players, onClose, isLoading, onPlayerClick }: any) {
  const playerMap = useMemo(() => new Map(players.map((p: any) => [p.id, p])), [players]);

  const rows = useMemo(() => {
    return (game.boxScore || [])
      .map((r: any) => ({ ...r, player: playerMap.get(r.pid) }))
      .filter((r: any) => r.player && r.min > 0);
  }, [game.boxScore, playerMap]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, overflowY:"auto", padding:"80px 16px 32px", background:"rgba(0,0,0,0.82)" }} onClick={onClose}>
      <div style={{ maxWidth:900, margin:"0 auto", borderRadius:16, border:`1px solid ${C.border2}`, background:C.surface, overflow:"hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:"18px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", background:C.base, borderBottom:`1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase", marginBottom:2 }}>{game.date}</div>
            <div style={{ fontSize:17, fontWeight:900, color:C.text }}>{game.home ? "vs" : "@"} {game.opponent} · <span style={{ color: game.result==="W" ? C.green : C.redText }}>{game.result} {game.score}</span></div>
            {(game.sourceUrl || game.youtubeUrl) && (
              <div style={{ display:"flex", gap:10, marginTop:8 }}>
                {game.sourceUrl && (
                  <a href={game.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, fontWeight:700, color:C.textDim, textDecoration:"none", padding:"3px 10px", borderRadius:6, border:`1px solid ${C.border2}`, display:"inline-flex", alignItems:"center", gap:5 }}
                    onClick={e => e.stopPropagation()}>
                    Official Stats ↗
                  </a>
                )}
                {game.youtubeUrl && (
                  <a href={game.youtubeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, fontWeight:700, color:"#ff4444", textDecoration:"none", padding:"3px 10px", borderRadius:6, border:"1px solid #ff444440", display:"inline-flex", alignItems:"center", gap:5 }}
                    onClick={e => e.stopPropagation()}>
                    Watch Replay ▶
                  </a>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ fontSize:28, fontWeight:900, color:C.textDim, background:"none", border:"none", cursor:"pointer" }}>×</button>
        </div>
        {isLoading ? (
          <div style={{ padding:48, textAlign:"center", color:C.textDim }}>
            <div style={{ fontSize:14, fontWeight:700 }}>Loading box score...</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX:"auto", padding:"0 0 4px" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:700 }}>
                <thead>
                  <tr style={{ background:C.base, borderBottom:`1px solid ${C.border2}` }}>
                    <th style={{ padding:"8px 12px", textAlign:"left", fontSize:10, fontWeight:900, color:C.textDim, letterSpacing:"0.12em", minWidth:48 }}>#</th>
                    <th style={{ padding:"8px 12px", textAlign:"left", fontSize:10, fontWeight:900, color:C.textDim, letterSpacing:"0.12em", minWidth:150 }}>PLAYER</th>
                    {BOX_COLS.map(c => <th key={c.key} style={{ padding:"8px 8px", fontSize:10, fontWeight:900, color:c.key==="eff"?C.redText:C.textDim, letterSpacing:"0.1em", minWidth:44, textAlign:"center" }}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any, i: number) => (
                    <tr key={r.pid} style={{ background: i%2===0 ? C.surface : C.surface2, borderBottom:`1px solid ${C.border}` }}>
                      <td style={{ padding:"8px 12px", fontWeight:700, color:C.textDim }}>{r.player.number}</td>
                      <td style={{ padding:"8px 12px" }}>
                        {onPlayerClick ? (
                          <button
                            onClick={() => onPlayerClick(r.pid)}
                            style={{
                              background:"none", border:"none", padding:0, textAlign:"left",
                              cursor:"pointer", fontFamily:"inherit", color:"inherit",
                              transition:"color 0.15s",
                            }}
                            onMouseEnter={e => { (e.currentTarget.querySelector("span") as HTMLElement).style.color = C.redText; }}
                            onMouseLeave={e => { (e.currentTarget.querySelector("span") as HTMLElement).style.color = C.text; }}
                          >
                            <span style={{ fontWeight:700, color:C.text, fontSize:13, display:"block", transition:"color 0.15s" }}>{fmt(r.player.name)}</span>
                            <span style={{ fontSize:10, color:C.textDim, letterSpacing:"0.1em", display:"block" }}>{r.player.position}</span>
                          </button>
                        ) : (
                          <>
                            <div style={{ fontWeight:700, color:C.text, fontSize:13 }}>{fmt(r.player.name)}</div>
                            <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.1em" }}>{r.player.position}</div>
                          </>
                        )}
                      </td>
                      {BOX_COLS.map(c => (
                        <td key={c.key} style={{ padding:"8px 8px", textAlign:"center", color: c.key==="eff" ? (r[c.key] >= 15 ? C.redText : r[c.key] < 0 ? "#ff4444" : C.textSub) : c.key==="pts" && r.pts >= 15 ? C.redText : C.textSub, fontWeight: c.key==="pts"||c.key==="eff" ? 900 : 400 }}>
                          {c.key === "min" ? (r.min > 0 ? fmtMinutes(r.min) : "--") : (r[c.key] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && (
              <div style={{ padding:32, textAlign:"center", color:C.textDim, fontSize:13 }}>No box score recorded for this game.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

function LeagueFilter({ leagues, selected, onChange }: any) {
  if (leagues.length <= 1) return null;
  const options = [{ slug: "all", name: "All" }, ...leagues];
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
      {options.map(l => {
        const active = l.slug === selected;
        return (
          <button
            key={l.slug}
            onClick={() => onChange(l.slug)}
            style={{
              padding: "5px 14px",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              borderRadius: 8,
              border: `1px solid ${active ? C.red : C.border}`,
              background: active ? C.red : "transparent",
              color: active ? C.text : C.textDim,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {l.name}
          </button>
        );
      })}
    </div>
  );
}

function ResultFilter({ selected, onChange }: any) {
  const options = [{ value: "all", label: "All" }, { value: "W", label: "Wins" }, { value: "L", label: "Losses" }];
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
      {options.map(o => {
        const active = o.value === selected;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: "5px 14px",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              borderRadius: 8,
              border: `1px solid ${active ? (o.value === "W" ? C.green : o.value === "L" ? C.redText : C.red) : C.border}`,
              background: active ? (o.value === "W" ? `${C.green}25` : o.value === "L" ? `${C.red}30` : C.red) : "transparent",
              color: active ? (o.value === "W" ? C.green : o.value === "L" ? C.redText : C.text) : C.textDim,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const CAL_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function CalendarView({ games, upcomingGames, onGameClick, loadingBoxScore }: any) {
  const [selectedUpcoming, setSelectedUpcoming] = useState<any>(null);

  // Months are driven by filtered played games only -- upcoming games appear
  // as overlays within those months but never add new months to the list.
  // This ensures league/result filters actually change which months are visible.
  const months = useMemo(() => {
    const keys = new Set<string>();
    games.forEach((g: any) => {
      const [yr, mo] = g.date.split("-");
      keys.add(`${yr}-${mo}`);
    });
    return [...keys].sort();
  }, [games]);

  // Default to the month closest to today (only computed once on mount)
  const initialKey = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 7);
    return months.find(k => k >= todayKey) || months[months.length - 1] || "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once -- avoids resetting when filters change

  const [activeKey, setActiveKey] = useState(initialKey);

  if (months.length === 0) return null;

  // Stay on the same month when filters change; fall back to last available
  const safeKey = months.includes(activeKey) ? activeKey : months[months.length - 1];
  const safeIdx = months.indexOf(safeKey);

  const [yr, mo] = safeKey.split("-").map(Number);
  const monthLabel = new Date(yr, mo - 1).toLocaleString("default", { month: "long" });
  // Monday-first: Mon=0 ... Sun=6
  const firstDow = (new Date(yr, mo - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(yr, mo, 0).getDate();

  // Played games for this month
  const dayMap = new Map<number, any>();
  games.forEach((g: any) => {
    const [gYr, gMo, gDay] = g.date.split("-").map(Number);
    if (gYr === yr && gMo === mo) dayMap.set(gDay, g);
  });

  // Upcoming games for this month
  const upcomingDayMap = new Map<number, any>();
  (upcomingGames || []).forEach((g: any) => {
    const [gYr, gMo, gDay] = g.scheduledFor.slice(0, 10).split("-").map(Number);
    if (gYr === yr && gMo === mo) upcomingDayMap.set(gDay, g);
  });

  const cells: Array<{ type: "empty"; id: string } | { type: "day"; day: number }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ type: "empty", id: `e${i}` });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ type: "day", day: d });

  const canPrev = safeIdx > 0;
  const canNext = safeIdx < months.length - 1;

  const navBtn = (disabled: boolean, onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 14px",
        borderRadius: 8,
        border: `1px solid ${disabled ? C.border : C.border2}`,
        background: "transparent",
        color: disabled ? C.textDim : C.text,
        cursor: disabled ? "default" : "pointer",
        fontSize: 16,
        fontFamily: "inherit",
        fontWeight: 900,
        opacity: disabled ? 0.3 : 1,
        transition: "all 0.15s",
        lineHeight: 1,
      }}
    >{label}</button>
  );

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Month header with nav arrows */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {navBtn(!canPrev, () => setActiveKey(months[safeIdx - 1]), "‹")}
          <div style={{ fontSize: 13, fontWeight: 900, color: C.text, letterSpacing: "0.14em", textTransform: "uppercase", textAlign: "center" }}>
            {monthLabel} {yr}
          </div>
          {navBtn(!canNext, () => setActiveKey(months[safeIdx + 1]), "›")}
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {CAL_DAYS.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 900, color: C.textDim, letterSpacing: "0.08em", padding: "3px 0" }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map(cell => {
            if (cell.type === "empty") {
              return <div key={cell.id} style={{ aspectRatio: "1" }} />;
            }
            const { day } = cell;
            const played = dayMap.get(day);
            const upcoming = upcomingDayMap.get(day);

            // Played game cell
            if (played) {
              const isWin = played.result === "W";
              return (
                <button
                  key={day}
                  onClick={!loadingBoxScore ? () => onGameClick(played) : undefined}
                  disabled={loadingBoxScore}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 8,
                    border: `1px solid ${isWin ? `${C.green}55` : `${C.redText}45`}`,
                    background: isWin ? `${C.green}28` : `${C.red}38`,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "3px 2px",
                    gap: 2,
                    transition: "border-color 0.15s, background 0.15s",
                    fontFamily: "inherit",
                    minWidth: 0,
                    overflow: "hidden",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = isWin ? C.green : C.redText; e.currentTarget.style.background = isWin ? `${C.green}40` : `${C.red}50`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = isWin ? `${C.green}55` : `${C.redText}45`; e.currentTarget.style.background = isWin ? `${C.green}28` : `${C.red}38`; }}
                >
                  <span style={{ fontSize: 10, fontWeight: 900, color: C.text, lineHeight: 1 }}>{day}</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: isWin ? C.green : C.redText, lineHeight: 1, letterSpacing: "0.04em" }}>{played.home ? "vs" : "@"}</span>
                  <span style={{ fontSize: 8, fontWeight: 900, color: C.text, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", padding: "0 3px" }}>{played.opponent}</span>
                </button>
              );
            }

            // Upcoming game cell -- always gold to avoid confusion with wins/losses
            if (upcoming) {
              const { tier } = getCountdownInfo(upcoming.scheduledFor);
              const isToday = tier === "today";
              const goldBorder = isToday ? `${C.gold}70` : `${C.gold}40`;
              const goldBg    = isToday ? `${C.gold}18` : `${C.gold}0d`;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedUpcoming(upcoming)}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 8,
                    border: `1px solid ${goldBorder}`,
                    background: goldBg,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "3px 2px",
                    gap: 2,
                    transition: "border-color 0.15s, background 0.15s",
                    fontFamily: "inherit",
                    minWidth: 0,
                    overflow: "hidden",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = `${C.gold}28`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = goldBorder; e.currentTarget.style.background = goldBg; }}
                >
                  <span style={{ fontSize: 10, fontWeight: 900, color: C.gold, lineHeight: 1 }}>{day}</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: C.gold, lineHeight: 1, letterSpacing: "0.04em" }}>{upcoming.location === "home" ? "vs" : "@"}</span>
                  <span style={{ fontSize: 8, fontWeight: 900, color: C.textSub, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", padding: "0 3px" }}>{upcoming.opponent}</span>
                  <span style={{ fontSize: 7, color: C.textDim, lineHeight: 1 }}>{formatGameTime(upcoming.scheduledFor)}</span>
                </button>
              );
            }

            // Empty day cell
            return (
              <div
                key={day}
                style={{
                  aspectRatio: "1",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 400, color: C.textDim, lineHeight: 1 }}>{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {selectedUpcoming && (
        <UpcomingGameModal game={selectedUpcoming} onClose={() => setSelectedUpcoming(null)} />
      )}
    </>
  );
}

const LIST_PAGE_SIZE = 10;

export default function GamesPage({ allGames, players, seasons, currentSeason, upcomingGames, allTimeStatsMap, playerSeasonHistory }: any) {
  const [selectedSeason, setSelectedSeason] = useState(currentSeason);
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [selectedResult, setSelectedResult] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loadingBoxScore, setLoadingBoxScore] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [listPage, setListPage] = useState(0);
  const [selectedUpcomingInList, setSelectedUpcomingInList] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  const playersWithStats = useMemo(() => players.map((p: any) => ({
    ...p,
    stats:         allTimeStatsMap?.[p.id] ?? { ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,ftmPg:0,ftaPg:0,mpg:0,eff:0,gp:0 },
    gameLog:       allTimeStatsMap?.[p.id]?.gameLog ?? [],
    seasonHistory: playerSeasonHistory?.[p.id] ?? {},
  })), [players, allTimeStatsMap, playerSeasonHistory]);

  const openPlayerById = (id: string) => {
    const match = playersWithStats.find((pp: any) => pp.id === id);
    if (match) setSelectedPlayer(match);
  };

  async function handleGameClick(game: any) {
    setLoadingBoxScore(true);
    setSelected(game); // Show modal immediately with loading state
    try {
      const res = await fetch(`/api/games/${game.id}`);
      const { boxScore } = await res.json();
      setSelected({ ...game, boxScore });
    } finally {
      setLoadingBoxScore(false);
    }
  }

  // Leagues available in the selected season (sorted by name)
  const seasonLeagues = useMemo(() => {
    const seen = new Map();
    allGames
      .filter((g: any) => g.season === selectedSeason)
      .forEach((g: any) => { if (!seen.has(g.league)) seen.set(g.league, g.leagueName); });
    return [...seen.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allGames, selectedSeason]);

  // No filters active = scheduled games are visible
  const noFiltersActive = selectedLeague === "all" && selectedResult === "all";

  const handleSeasonChange = (sid: any) => {
    setSelectedSeason(sid);
    setSelectedLeague("all");
    setSelectedResult("all");
    setListPage(0);
  };

  const handleLeagueChange = (v: string) => { setSelectedLeague(v); setListPage(0); };
  const handleResultChange = (v: string) => { setSelectedResult(v); setListPage(0); };

  const filtered = useMemo(() => {
    return allGames
      .filter((g: any) => g.season === selectedSeason)
      .filter((g: any) => selectedLeague === "all" || g.league === selectedLeague)
      .filter((g: any) => selectedResult === "all" || g.result === selectedResult)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allGames, selectedSeason, selectedLeague, selectedResult]);

  // Combined list: upcoming (when no filters) + played, sorted newest first
  const listItems = useMemo(() => {
    const played = filtered.map((g: any) => ({ ...g, _upcoming: false, _sortDate: g.date }));
    if (!noFiltersActive) return played;
    const upcoming = (upcomingGames || []).map((g: any) => ({
      ...g,
      _upcoming: true,
      _sortDate: g.scheduledFor.slice(0, 10),
    }));
    return [...upcoming, ...played].sort((a: any, b: any) =>
      new Date(b._sortDate).getTime() - new Date(a._sortDate).getTime()
    );
  }, [filtered, upcomingGames, noFiltersActive]);

  const totalPages = Math.ceil(listItems.length / LIST_PAGE_SIZE);
  const pagedItems = listItems.slice(listPage * LIST_PAGE_SIZE, (listPage + 1) * LIST_PAGE_SIZE);

  return (
    <Layout title="Games">
      <SectionHeading
        label={`${selectedSeason.replace(/-/g, "-")} Season`}
        title="Games"
      />

      <SeasonSelector
        seasons={seasons}
        currentSeason={selectedSeason}
        onChange={handleSeasonChange}
        showAllTime={false}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim }}>{filtered.length} GAMES</span>
            <div style={{ display: "flex", gap: 2, background: C.surface2, borderRadius: 8, padding: 2, border: `1px solid ${C.border}` }}>
              {(["list", "calendar"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={mode === "list" ? "List view" : "Calendar view"}
                  style={{
                    padding: "4px 9px",
                    borderRadius: 6,
                    border: "none",
                    background: viewMode === mode ? C.red : "transparent",
                    color: viewMode === mode ? C.text : C.textDim,
                    cursor: "pointer",
                    fontSize: 11,
                    fontFamily: "inherit",
                    fontWeight: 900,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    transition: "all 0.15s",
                  }}
                >
                  {mode === "list" ? "≡" : "▦"}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <LeagueFilter
        leagues={seasonLeagues}
        selected={selectedLeague}
        onChange={handleLeagueChange}
      />

      <ResultFilter selected={selectedResult} onChange={handleResultChange} />

      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:48, color:C.textDim }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:15, fontWeight:700 }}>No games recorded yet</div>
        </div>
      ) : viewMode === "calendar" ? (
        <CalendarView
          games={filtered}
          upcomingGames={noFiltersActive ? upcomingGames : []}
          onGameClick={handleGameClick}
          loadingBoxScore={loadingBoxScore}
        />
      ) : (
        <>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {pagedItems.map((g: any) => {
              if (g._upcoming) {
                const { label, tier } = getCountdownInfo(g.scheduledFor);
                const accentColor = tier === "today" ? C.gold : tier === "week" ? C.redText : C.textSub;
                return (
                  <button
                    key={`upcoming-${g.id ?? g.scheduledFor}`}
                    onClick={() => setSelectedUpcomingInList(g)}
                    style={{
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"14px 18px", borderRadius:12,
                      border:`1px solid ${C.gold}30`,
                      background:`${C.gold}08`, cursor:"pointer", textAlign:"left", fontFamily:"inherit",
                      transition:"border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=`${C.gold}60`; e.currentTarget.style.background=`${C.gold}14`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=`${C.gold}30`; e.currentTarget.style.background=`${C.gold}08`; }}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <span style={{
                        width:34, height:34, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:14, fontWeight:900, flexShrink:0,
                        background:`${C.gold}15`, color:C.gold, border:`1px solid ${C.gold}35`,
                      }}>▸</span>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{g.location === "home" ? "vs" : "@"} {g.opponent}</div>
                        <div style={{ fontSize:11, color:accentColor, marginTop:2, fontWeight:700 }}>{label}</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:24 }}>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:13, fontWeight:700, color:C.textSub }}>{g.scheduledFor.slice(0, 10)}</div>
                        {g.competition && <div style={{ fontSize:11, color:C.textDim }}>{g.competition}</div>}
                      </div>
                      <div style={{ fontSize:11, color:C.gold, fontWeight:700 }}>UPCOMING -></div>
                    </div>
                  </button>
                );
              }

              const topScorer = formatTopScorer(g.topScorer);
              return (
                <button key={g.id} onClick={() => handleGameClick(g)} disabled={loadingBoxScore} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"14px 18px", borderRadius:12, border:`1px solid ${C.border}`,
                  background:C.surface, cursor:"pointer", textAlign:"left", fontFamily:"inherit",
                  transition:"border-color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor=`${C.redBright}55`}
                onMouseLeave={e => e.currentTarget.style.borderColor=C.border}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{
                      width:34, height:34, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:12, fontWeight:900, flexShrink:0,
                      background: g.result==="W" ? `${C.green}20` : `${C.red}30`,
                      color: g.result==="W" ? C.green : C.redText,
                      border: `1px solid ${g.result==="W" ? `${C.green}40` : `${C.redText}30`}`,
                    }}>{g.result}</span>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{g.home ? "vs" : "@"} {g.opponent}</div>
                      <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>
                        {g.date}
                        {seasonLeagues.length > 1 && selectedLeague === "all" && (
                          <span style={{ marginLeft:8, color:C.textDim, opacity:0.7 }}>{g.leagueName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:24 }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:18, fontWeight:900, color:C.text }}>{g.score}</div>
                      {topScorer && <div style={{ fontSize:11, color:C.textDim }}>{topScorer}</div>}
                    </div>
                    <div style={{ fontSize:11, color:C.textDim }}>BOX SCORE -></div>
                  </div>
                </button>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:16, padding:"0 2px" }}>
              <button
                onClick={() => setListPage(p => p - 1)}
                disabled={listPage === 0}
                style={{
                  padding:"7px 18px", borderRadius:8, border:`1px solid ${listPage === 0 ? C.border : C.border2}`,
                  background:"transparent", color: listPage === 0 ? C.textDim : C.text,
                  cursor: listPage === 0 ? "default" : "pointer", fontSize:16, fontFamily:"inherit",
                  fontWeight:900, opacity: listPage === 0 ? 0.3 : 1, transition:"all 0.15s", lineHeight:1,
                }}
              >‹</button>
              <span style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.1em" }}>
                {listPage * LIST_PAGE_SIZE + 1}-{Math.min((listPage + 1) * LIST_PAGE_SIZE, listItems.length)} of {listItems.length}
              </span>
              <button
                onClick={() => setListPage(p => p + 1)}
                disabled={listPage >= totalPages - 1}
                style={{
                  padding:"7px 18px", borderRadius:8, border:`1px solid ${listPage >= totalPages - 1 ? C.border : C.border2}`,
                  background:"transparent", color: listPage >= totalPages - 1 ? C.textDim : C.text,
                  cursor: listPage >= totalPages - 1 ? "default" : "pointer", fontSize:16, fontFamily:"inherit",
                  fontWeight:900, opacity: listPage >= totalPages - 1 ? 0.3 : 1, transition:"all 0.15s", lineHeight:1,
                }}
              >›</button>
            </div>
          )}
        </>
      )}
      {selected && <BoxScore game={selected} players={players} onClose={() => setSelected(null)} isLoading={loadingBoxScore} onPlayerClick={openPlayerById} />}
      {selectedUpcomingInList && <UpcomingGameModal game={selectedUpcomingInList} onClose={() => setSelectedUpcomingInList(null)} />}
      {selectedPlayer && <PlayerDetail player={selectedPlayer} onClose={() => setSelectedPlayer(null)} activeSeason="all-time" />}
    </Layout>
  );
}

export async function getStaticProps() {
  const [allGames, players, seasons, config, upcomingGames] = await Promise.all([
    getAllGames(),
    getPlayers(),
    getSeasons(),
    getConfig(),
    getAllUpcomingGames(),
  ]);

  const allSeasonsStats = await getAllSeasonsStats(seasons);
  const allTimeStatsMap = buildAllTimeStatsMap(allSeasonsStats, players);

  const playerSeasonHistory: Record<string, any> = {};
  for (const [sid, seasonMap] of Object.entries(allSeasonsStats)) {
    for (const player of players) {
      const s = (seasonMap as any)[player.id];
      if (s && s.gp > 0) {
        if (!playerSeasonHistory[player.id]) playerSeasonHistory[player.id] = {};
        playerSeasonHistory[player.id][sid] = s;
      }
    }
  }

  return {
    props: { allGames, players, seasons, currentSeason: config.currentSeason, upcomingGames, allTimeStatsMap, playerSeasonHistory },
    revalidate: 86400,
  };
}
