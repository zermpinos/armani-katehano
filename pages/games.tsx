import { useState, useMemo, useEffect, memo } from "react";
import Layout from "../components/Layout";
import { SectionHeading } from "../components/ui";
import SeasonSelector from "../components/SeasonSelector";
import { C } from "../lib/theme";
import { getAllGames, getPlayers, getSeasons, getConfig } from "../lib/data";
import ErrorBoundary from "../components/ErrorBoundary";
import { fmt } from "../lib/utils";

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

const BoxScore = memo(function BoxScore({ game, players, onClose, isLoading }: any) {
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
                        <div style={{ fontWeight:700, color:C.text, fontSize:13 }}>{fmt(r.player.name)}</div>
                        <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.1em" }}>{r.player.position}</div>
                      </td>
                      {BOX_COLS.map(c => (
                        <td key={c.key} style={{ padding:"8px 8px", textAlign:"center", color: c.key==="eff" ? (r[c.key] >= 15 ? C.redText : r[c.key] < 0 ? "#ff4444" : C.textSub) : c.key==="pts" && r.pts >= 15 ? C.redText : C.textSub, fontWeight: c.key==="pts"||c.key==="eff" ? 900 : 400 }}>
                          {r[c.key] ?? 0}
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

const CAL_DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function CalendarView({ games, onGameClick, loadingBoxScore }: any) {
  const months = useMemo(() => {
    const map = new Map<string, any[]>();
    games.forEach((g: any) => {
      const [yr, mo] = g.date.split("-");
      const key = `${yr}-${mo}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, gs]) => ({ key, games: gs }));
  }, [games]);

  const [monthIdx, setMonthIdx] = useState(() => months.length - 1);

  // Keep index in bounds if games change (e.g. season switch)
  const safeIdx = Math.min(Math.max(monthIdx, 0), months.length - 1);

  if (months.length === 0) return null;

  const { key, games: monthGames } = months[safeIdx];
  const [yr, mo] = key.split("-").map(Number);
  const monthLabel = new Date(yr, mo - 1).toLocaleString("default", { month: "long" });
  const firstDow = new Date(yr, mo - 1, 1).getDay();
  const daysInMonth = new Date(yr, mo, 0).getDate();

  const dayMap = new Map<number, any[]>();
  monthGames.forEach((g: any) => {
    const d = parseInt(g.date.split("-")[2]);
    if (!dayMap.has(d)) dayMap.set(d, []);
    dayMap.get(d)!.push(g);
  });

  const cells: Array<{ type: "empty"; id: string } | { type: "day"; day: number; gs: any[] }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ type: "empty", id: `e${i}` });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ type: "day", day: d, gs: dayMap.get(d) || [] });

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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Month header with nav arrows */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {navBtn(!canPrev, () => setMonthIdx(safeIdx - 1), "‹")}
        <div style={{ fontSize: 13, fontWeight: 900, color: C.text, letterSpacing: "0.14em", textTransform: "uppercase", textAlign: "center" }}>
          {monthLabel} {yr}
        </div>
        {navBtn(!canNext, () => setMonthIdx(safeIdx + 1), "›")}
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
          const { day, gs } = cell;
          const hasGame = gs.length > 0;
          const g = gs[0];
          const isWin = hasGame && g.result === "W";
          return (
            <button
              key={day}
              onClick={hasGame && !loadingBoxScore ? () => onGameClick(g) : undefined}
              disabled={!hasGame}
              style={{
                aspectRatio: "1",
                borderRadius: 8,
                border: `1px solid ${hasGame ? (isWin ? `${C.green}55` : `${C.redText}45`) : C.border}`,
                background: hasGame ? (isWin ? `${C.green}28` : `${C.red}38`) : C.surface,
                cursor: hasGame ? "pointer" : "default",
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
              onMouseEnter={e => { if (hasGame) { e.currentTarget.style.borderColor = isWin ? C.green : C.redText; e.currentTarget.style.background = isWin ? `${C.green}40` : `${C.red}50`; } }}
              onMouseLeave={e => { if (hasGame) { e.currentTarget.style.borderColor = isWin ? `${C.green}55` : `${C.redText}45`; e.currentTarget.style.background = isWin ? `${C.green}28` : `${C.red}38`; } }}
            >
              <span style={{ fontSize: 10, fontWeight: hasGame ? 900 : 400, color: hasGame ? C.text : C.textDim, lineHeight: 1 }}>{day}</span>
              {hasGame && (
                <>
                  <span style={{ fontSize: 8, fontWeight: 700, color: isWin ? C.green : C.redText, lineHeight: 1, letterSpacing: "0.04em" }}>{g.home ? "vs" : "@"}</span>
                  <span style={{ fontSize: 8, fontWeight: 900, color: C.text, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", padding: "0 3px" }}>{g.opponent}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function GamesPage({ allGames, players, seasons, currentSeason }: any) {
  const [selectedSeason, setSelectedSeason] = useState(currentSeason);
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [selectedResult, setSelectedResult] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loadingBoxScore, setLoadingBoxScore] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

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

  // Reset league filter when season changes and the current league isn't available
  const handleSeasonChange = (sid: any) => {
    setSelectedSeason(sid);
    setSelectedLeague("all");
    setSelectedResult("all");
  };

  const filtered = useMemo(() => {
    return allGames
      .filter((g: any) => g.season === selectedSeason)
      .filter((g: any) => selectedLeague === "all" || g.league === selectedLeague)
      .filter((g: any) => selectedResult === "all" || g.result === selectedResult)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allGames, selectedSeason, selectedLeague, selectedResult]);

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
        onChange={setSelectedLeague}
      />

      <ResultFilter selected={selectedResult} onChange={setSelectedResult} />

      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:48, color:C.textDim }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:15, fontWeight:700 }}>No games recorded yet</div>
        </div>
      ) : viewMode === "calendar" ? (
        <CalendarView games={filtered} onGameClick={handleGameClick} loadingBoxScore={loadingBoxScore} />
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map((g: any) => {
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
                  <div style={{ fontSize:11, color:C.textDim }}>BOX SCORE →</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {selected && <BoxScore game={selected} players={players} onClose={() => setSelected(null)} isLoading={loadingBoxScore} />}
    </Layout>
  );
}

export async function getStaticProps() {
  const [allGames, players, seasons, config] = await Promise.all([
    getAllGames(),
    getPlayers(),
    getSeasons(),
    getConfig(),
  ]);
  return {
    props: { allGames, players, seasons, currentSeason: config.currentSeason },
    revalidate: 3600,
  };
}
