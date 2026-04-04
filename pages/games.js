import { useState, useMemo, useEffect } from "react";
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

function getTopScorer(game, players) {
  const rows = game.boxScore;
  if (!rows || rows.length === 0) return null;

  const playing = rows.filter(r => (r.min || r.minutes || 0) > 0);
  if (playing.length === 0) return null;

  const best = playing.reduce((top, r) => (r.pts ?? 0) > (top.pts ?? 0) ? r : top, playing[0]);
  if (!best || (best.pts ?? 0) === 0) return null;

  const player = players.find(p => p.id === (best.pid || best.playerId));
  if (!player) return null;

  return `${fmt(player.name)} ${best.pts} PTS`;
}

function BoxScore({ game, players, onClose }) {
  const rows = (game.boxScore || [])
    .map(r => ({ ...r, player: players.find(p => p.id === r.pid) }))
    .filter(r => r.player && r.min > 0)
    .sort((a, b) => Number(a.player.number) - Number(b.player.number));

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
              {rows.map((r, i) => (
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
      </div>
    </div>
  );
}

function LeagueFilter({ leagues, selected, onChange }) {
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

function ResultFilter({ selected, onChange }) {
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

export default function GamesPage({ allGames, players, seasons, currentSeason }) {
  const [selectedSeason, setSelectedSeason] = useState(currentSeason);
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [selectedResult, setSelectedResult] = useState("all");
  const [selected, setSelected] = useState(null);

  // Leagues available in the selected season (sorted by name)
  const seasonLeagues = useMemo(() => {
    const seen = new Map();
    allGames
      .filter(g => g.season === selectedSeason)
      .forEach(g => { if (!seen.has(g.league)) seen.set(g.league, g.leagueName); });
    return [...seen.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allGames, selectedSeason]);

  // Reset league filter when season changes and the current league isn't available
  const handleSeasonChange = (sid) => {
    setSelectedSeason(sid);
    setSelectedLeague("all");
    setSelectedResult("all");
  };

  const filtered = useMemo(() => {
    return allGames
      .filter(g => g.season === selectedSeason)
      .filter(g => selectedLeague === "all" || g.league === selectedLeague)
      .filter(g => selectedResult === "all" || g.result === selectedResult)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
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
        right={`${filtered.length} Games`}
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
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(g => {
            const topScorer = getTopScorer(g, players);

            return (
              <button key={g.id} onClick={() => setSelected(g)} style={{
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
      {selected && <BoxScore game={selected} players={players} onClose={() => setSelected(null)} />}
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
