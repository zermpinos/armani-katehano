import { useState, useMemo, useEffect, memo } from "react";
import Layout from "../components/Layout";
import { SectionHeading } from "../components/ui";
import SeasonSelector from "../components/SeasonSelector";
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
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
  const accentCls = tier === "today" ? "text-ak-gold" : tier === "week" ? "text-ak-red-text" : "text-ak-text-sub";

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75"
      onClick={onClose}
    >
      <div
        className="bg-ak-surface rounded-2xl p-6 max-w-[360px] w-full border border-ak-border2 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] font-black tracking-[0.18em] uppercase mb-1.5 ${accentCls}`}>
              {tier === "today" ? "⚡ Today" : "Upcoming"}
            </div>
            <div className="text-xl font-black text-ak-text leading-tight">
              {game.location === "home" ? "vs" : "@"} {game.opponent}
            </div>
            {game.competition && (
              <div className="text-xs text-ak-text-dim mt-1">{game.competition}</div>
            )}
          </div>
          <button onClick={onClose} className="bg-transparent border-0 text-ak-text-dim text-2xl cursor-pointer font-black pl-3 leading-none">×</button>
        </div>

        {/* Date / time / venue row */}
        <div className="flex flex-col gap-1.5 mb-5">
          <div className="flex items-center gap-2">
            <span className={`text-[13px] font-bold ${accentCls}`}>{label}</span>
            <span className="text-[13px] font-bold text-ak-text-sub">· {gameTime}</span>
          </div>
          {venue && (
            <a
              href={getVenueUrl(venue)}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-ak-text-sub no-underline"
            >
              📍 {venue}
            </a>
          )}
        </div>

        {/* Calendar buttons */}
        <div className="flex gap-2">
          <a
            href={buildGoogleCalendarUrl(game.opponent, game.scheduledFor, venue)}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-[10px] px-3 rounded-lg border border-[#4285F440] bg-[#4285F410] text-[#4285F4] text-xs font-bold no-underline"
          >
            <GoogleCalIcon /> Google
          </a>
          <button
            onClick={() => downloadIcsFile(game.opponent, game.scheduledFor, venue)}
            className="flex-1 flex items-center justify-center gap-1.5 py-[10px] px-3 rounded-lg border border-ak-border2 bg-ak-base text-ak-text-sub text-xs font-bold cursor-pointer"
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
    <div className="fixed inset-0 z-[100] overflow-y-auto pt-20 px-4 pb-8 bg-black/[0.82]" onClick={onClose}>
      <div className="max-w-[900px] mx-auto rounded-2xl border border-ak-border2 bg-ak-surface overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-[18px] flex justify-between items-center bg-ak-base border-b border-ak-border">
          <div>
            <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-0.5">{game.date}</div>
            <div className="text-[17px] font-black text-ak-text">
              {game.home ? "vs" : "@"} {game.opponent} · <span className={game.result==="W" ? "text-ak-green" : "text-ak-red-text"}>{game.result} {game.score}</span>
            </div>
            {(game.sourceUrl || game.youtubeUrl) && (
              <div className="flex gap-[10px] mt-2">
                {game.sourceUrl && (
                  <a href={game.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-ak-text-dim no-underline py-[3px] px-[10px] rounded-md border border-ak-border2 inline-flex items-center gap-[5px]"
                    onClick={e => e.stopPropagation()}>
                    Official Stats ↗
                  </a>
                )}
                {game.youtubeUrl && (
                  <a href={game.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-[#ff4444] no-underline py-[3px] px-[10px] rounded-md border border-[#ff444440] inline-flex items-center gap-[5px]"
                    onClick={e => e.stopPropagation()}>
                    Watch Replay ▶
                  </a>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-[28px] font-black text-ak-text-dim bg-transparent border-0 cursor-pointer">×</button>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-ak-text-dim">
            <div className="text-sm font-bold">Loading box score...</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto pb-1">
              <table className="w-full border-collapse text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-ak-base border-b border-ak-border2">
                    <th className="px-3 py-2 text-left text-[10px] font-black text-ak-text-dim tracking-[0.12em] min-w-[48px]">#</th>
                    <th className="px-3 py-2 text-left text-[10px] font-black text-ak-text-dim tracking-[0.12em] min-w-[150px]">PLAYER</th>
                    {BOX_COLS.map(c => (
                      <th key={c.key} className={`px-2 py-2 text-[10px] font-black tracking-[0.1em] min-w-[44px] text-center ${c.key==="eff" ? "text-ak-red-text" : "text-ak-text-dim"}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any, i: number) => (
                    <tr key={r.pid} className={`border-b border-ak-border ${i%2===0 ? "bg-ak-surface" : "bg-ak-surface2"}`}>
                      <td className="px-3 py-2 font-bold text-ak-text-dim">{r.player.number}</td>
                      <td className="px-3 py-2">
                        {onPlayerClick ? (
                          <button
                            onClick={() => onPlayerClick(r.pid)}
                            className="bg-transparent border-0 p-0 text-left cursor-pointer group"
                          >
                            <span className="font-bold text-ak-text text-[13px] block transition-colors duration-150 group-hover:text-ak-red-text">{fmt(r.player.name)}</span>
                            <span className="text-[10px] text-ak-text-dim tracking-[0.1em] block">{r.player.position}</span>
                          </button>
                        ) : (
                          <>
                            <div className="font-bold text-ak-text text-[13px]">{fmt(r.player.name)}</div>
                            <div className="text-[10px] text-ak-text-dim tracking-[0.1em]">{r.player.position}</div>
                          </>
                        )}
                      </td>
                      {BOX_COLS.map(c => (
                        <td
                          key={c.key}
                          className={`px-2 py-2 text-center ${c.key==="pts"||c.key==="eff" ? "font-black" : "font-normal"} ${
                            c.key==="eff"
                              ? (r[c.key] >= 15 ? "text-ak-red-text" : r[c.key] < 0 ? "text-[#ff4444]" : "text-ak-text-sub")
                              : c.key==="pts" && r.pts >= 15
                                ? "text-ak-red-text"
                                : "text-ak-text-sub"
                          }`}
                        >
                          {c.key === "min" ? (r.min > 0 ? fmtMinutes(r.min) : "—") : (r[c.key] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && (
              <div className="p-8 text-center text-ak-text-dim text-[13px]">No box score recorded for this game.</div>
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
    <div className="flex gap-1.5 flex-wrap mb-5">
      {options.map(l => {
        const active = l.slug === selected;
        return (
          <button
            key={l.slug}
            onClick={() => onChange(l.slug)}
            className={`py-[5px] px-[14px] text-[11px] font-black tracking-[0.12em] uppercase rounded-lg border cursor-pointer transition-all duration-150 ${
              active ? "border-ak-red bg-ak-red text-ak-text" : "border-ak-border bg-transparent text-ak-text-dim"
            }`}
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
    <div className="flex gap-1.5 flex-wrap mb-5">
      {options.map(o => {
        const active = o.value === selected;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`py-[5px] px-[14px] text-[11px] font-black tracking-[0.12em] uppercase rounded-lg border cursor-pointer transition-all duration-150 ${
              active
                ? o.value === "W"
                  ? "border-ak-green bg-[#4caf7d25] text-ak-green"
                  : o.value === "L"
                    ? "border-ak-red-text bg-[#8b1a1a30] text-ak-red-text"
                    : "border-ak-red bg-ak-red text-ak-text"
                : "border-ak-border bg-transparent text-ak-text-dim"
            }`}
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

  // Months are driven by filtered played games only — upcoming games appear
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
  }, []); // intentionally run once — avoids resetting when filters change

  const [activeKey, setActiveKey] = useState(initialKey);

  if (months.length === 0) return null;

  // Stay on the same month when filters change; fall back to last available
  const safeKey = months.includes(activeKey) ? activeKey : months[months.length - 1];
  const safeIdx = months.indexOf(safeKey);

  const [yr, mo] = safeKey.split("-").map(Number);
  const monthLabel = new Date(yr, mo - 1).toLocaleString("default", { month: "long" });
  // Monday-first: Mon=0 … Sun=6
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
      className={`px-[14px] py-[6px] rounded-lg bg-transparent border transition-all duration-150 text-base font-black leading-none ${
        disabled
          ? "border-ak-border text-ak-text-dim cursor-default opacity-30"
          : "border-ak-border2 text-ak-text cursor-pointer"
      }`}
    >{label}</button>
  );

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Month header with nav arrows */}
        <div className="flex items-center justify-between gap-2">
          {navBtn(!canPrev, () => setActiveKey(months[safeIdx - 1]), "‹")}
          <div className="text-[13px] font-black text-ak-text tracking-[0.14em] uppercase text-center">
            {monthLabel} {yr}
          </div>
          {navBtn(!canNext, () => setActiveKey(months[safeIdx + 1]), "›")}
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-0.5">
          {CAL_DAYS.map(d => (
            <div key={d} className="text-center text-[9px] font-black text-ak-text-dim tracking-[0.08em] py-[3px]">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map(cell => {
            if (cell.type === "empty") {
              return <div key={cell.id} className="aspect-square" />;
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
                  className={`aspect-square rounded-lg cursor-pointer flex flex-col items-center justify-center p-[3px_2px] gap-0.5 transition-[border-color,background] duration-150 min-w-0 overflow-hidden ${
                    isWin
                      ? "border border-[#4caf7d55] bg-[#4caf7d28] hover:border-ak-green hover:bg-[#4caf7d40]"
                      : "border border-[#e0555545] bg-[#8b1a1a38] hover:border-ak-red-text hover:bg-[#8b1a1a50]"
                  }`}
                >
                  <span className="text-[10px] font-black text-ak-text leading-none">{day}</span>
                  <span className={`text-[8px] font-bold leading-none tracking-[0.04em] ${isWin ? "text-ak-green" : "text-ak-red-text"}`}>{played.home ? "vs" : "@"}</span>
                  <span className="text-[8px] font-black text-ak-text leading-none whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-[3px]">{played.opponent}</span>
                </button>
              );
            }

            // Upcoming game cell — always gold to avoid confusion with wins/losses
            if (upcoming) {
              const { tier } = getCountdownInfo(upcoming.scheduledFor);
              const isToday = tier === "today";
              return (
                <button
                  key={day}
                  onClick={() => setSelectedUpcoming(upcoming)}
                  className={`aspect-square rounded-lg cursor-pointer flex flex-col items-center justify-center p-[3px_2px] gap-0.5 transition-[border-color,background] duration-150 min-w-0 overflow-hidden hover:border-ak-gold hover:bg-[#c9a84c28] ${
                    isToday
                      ? "border border-[#c9a84c70] bg-[#c9a84c18]"
                      : "border border-[#c9a84c40] bg-[#c9a84c0d]"
                  }`}
                >
                  <span className="text-[10px] font-black text-ak-gold leading-none">{day}</span>
                  <span className="text-[8px] font-bold text-ak-gold leading-none tracking-[0.04em]">{upcoming.location === "home" ? "vs" : "@"}</span>
                  <span className="text-[8px] font-black text-ak-text-sub leading-none whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-[3px]">{upcoming.opponent}</span>
                  <span className="text-[7px] text-ak-text-dim leading-none">{formatGameTime(upcoming.scheduledFor)}</span>
                </button>
              );
            }

            // Empty day cell
            return (
              <div
                key={day}
                className="aspect-square rounded-lg border border-ak-border bg-ak-surface flex items-center justify-center"
              >
                <span className="text-[10px] font-normal text-ak-text-dim leading-none">{day}</span>
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
        label={`${selectedSeason.replace(/-/g, "–")} Season`}
        title="Games"
      />

      <SeasonSelector
        seasons={seasons}
        currentSeason={selectedSeason}
        onChange={handleSeasonChange}
        showAllTime={false}
        right={
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim">{filtered.length} GAMES</span>
            <div className="flex gap-0.5 bg-ak-surface2 rounded-lg p-0.5 border border-ak-border">
              {(["list", "calendar"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={mode === "list" ? "List view" : "Calendar view"}
                  className={`px-[9px] py-1 rounded-md border-0 text-[11px] font-black tracking-[0.1em] uppercase cursor-pointer transition-all duration-150 ${
                    viewMode === mode ? "bg-ak-red text-ak-text" : "bg-transparent text-ak-text-dim"
                  }`}
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
        <div className="text-center p-12 text-ak-text-dim">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-[15px] font-bold">No games recorded yet</div>
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
          <div className="flex flex-col gap-2">
            {pagedItems.map((g: any) => {
              if (g._upcoming) {
                const { label, tier } = getCountdownInfo(g.scheduledFor);
                const accentCls = tier === "today" ? "text-ak-gold" : tier === "week" ? "text-ak-red-text" : "text-ak-text-sub";
                return (
                  <button
                    key={`upcoming-${g.id ?? g.scheduledFor}`}
                    onClick={() => setSelectedUpcomingInList(g)}
                    className="flex items-center justify-between py-[14px] px-[18px] rounded-xl border border-[#c9a84c30] bg-[#c9a84c08] cursor-pointer text-left transition-[border-color,background] duration-150 hover:border-[#c9a84c60] hover:bg-[#c9a84c14]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-sm font-black shrink-0 bg-[#c9a84c15] text-ak-gold border border-[#c9a84c35]">▸</span>
                      <div>
                        <div className="text-sm font-bold text-ak-text">{g.location === "home" ? "vs" : "@"} {g.opponent}</div>
                        <div className={`text-[11px] mt-0.5 font-bold ${accentCls}`}>{label}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-[13px] font-bold text-ak-text-sub">{g.scheduledFor.slice(0, 10)}</div>
                        {g.competition && <div className="text-[11px] text-ak-text-dim">{g.competition}</div>}
                      </div>
                      <div className="text-[11px] text-ak-gold font-bold">UPCOMING →</div>
                    </div>
                  </button>
                );
              }

              const topScorer = formatTopScorer(g.topScorer);
              return (
                <button
                  key={g.id}
                  onClick={() => handleGameClick(g)}
                  disabled={loadingBoxScore}
                  className="flex items-center justify-between py-[14px] px-[18px] rounded-xl border border-ak-border bg-ak-surface cursor-pointer text-left transition-[border-color] duration-150 hover:border-[#c0392b55]"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-xs font-black shrink-0 border ${
                      g.result==="W"
                        ? "bg-[#4caf7d20] text-ak-green border-[#4caf7d40]"
                        : "bg-[#8b1a1a30] text-ak-red-text border-[#e0555530]"
                    }`}>{g.result}</span>
                    <div>
                      <div className="text-sm font-bold text-ak-text">{g.home ? "vs" : "@"} {g.opponent}</div>
                      <div className="text-[11px] text-ak-text-dim mt-0.5">
                        {g.date}
                        {seasonLeagues.length > 1 && selectedLeague === "all" && (
                          <span className="ml-2 text-ak-text-dim opacity-70">{g.leagueName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-lg font-black text-ak-text">{g.score}</div>
                      {topScorer && <div className="text-[11px] text-ak-text-dim">{topScorer}</div>}
                    </div>
                    <div className="text-[11px] text-ak-text-dim">BOX SCORE →</div>
                  </div>
                </button>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-0.5">
              <button
                onClick={() => setListPage(p => p - 1)}
                disabled={listPage === 0}
                className={`py-[7px] px-[18px] rounded-lg bg-transparent border transition-all duration-150 text-base font-black leading-none ${
                  listPage === 0
                    ? "border-ak-border text-ak-text-dim cursor-default opacity-30"
                    : "border-ak-border2 text-ak-text cursor-pointer"
                }`}
              >‹</button>
              <span className="text-[11px] font-bold text-ak-text-dim tracking-[0.1em]">
                {listPage * LIST_PAGE_SIZE + 1}–{Math.min((listPage + 1) * LIST_PAGE_SIZE, listItems.length)} of {listItems.length}
              </span>
              <button
                onClick={() => setListPage(p => p + 1)}
                disabled={listPage >= totalPages - 1}
                className={`py-[7px] px-[18px] rounded-lg bg-transparent border transition-all duration-150 text-base font-black leading-none ${
                  listPage >= totalPages - 1
                    ? "border-ak-border text-ak-text-dim cursor-default opacity-30"
                    : "border-ak-border2 text-ak-text cursor-pointer"
                }`}
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

  // Object.create(null) prevents prototype pollution when player.id/sid are from DB data
  const playerSeasonHistory: Record<string, any> = Object.create(null);
  for (const [sid, seasonMap] of Object.entries(allSeasonsStats)) {
    for (const player of players) {
      const s = (seasonMap as any)[player.id];
      if (s && s.gp > 0) {
        // eslint-disable-next-line security/detect-object-injection
        if (!playerSeasonHistory[player.id]) playerSeasonHistory[player.id] = Object.create(null);
        // eslint-disable-next-line security/detect-object-injection
        playerSeasonHistory[player.id][sid] = s;
      }
    }
  }

  return {
    props: { allGames, players, seasons, currentSeason: config.currentSeason, upcomingGames, allTimeStatsMap, playerSeasonHistory },
    revalidate: 86400,
  };
}
