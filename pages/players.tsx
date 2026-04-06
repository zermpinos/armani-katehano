import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { SectionHeading } from "../components/ui";
import { C, chartTooltipStyle } from "../lib/theme";
import { getAllPublicData, getAllSeasonsStats } from "../lib/data";
import { buildAllTimeStatsMap } from "../lib/stats";
import { fmt, fmtMinutes } from "../lib/utils";
import SeasonSelector from "../components/SeasonSelector";
import ErrorBoundary from "../components/ErrorBoundary";
import { LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "../components/Charts";


// Player photos come from the photoUrl field in the database.
// Falls back to null (shows 🏀 emoji) if not set.
const playerImg = (player: any) => player.photoUrl || null;

function StatCell({ label, value, highlight = false }: any) {
  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      borderRadius:10, padding:"10px 4px", border:`1px solid ${highlight ? `${C.redBright}45` : C.border}`,
      background: highlight ? `${C.red}20` : C.surface2,
    }}>
      <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.12em", color:C.textDim }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:900, color: highlight ? C.redText : C.text, marginTop:2 }}>{value}</div>
    </div>
  );
}

function PlayerDetail({ player, onClose, activeSeason }: any) {
  const s = player.stats;
  const gameLog = player.gameLog || [];

  // Derive available seasons and leagues from gameLog
  const seasons = ["All", ...Array.from(new Set<string>(gameLog.map((g: any) => g.season).filter(Boolean) as string[])).sort().reverse()];
  const leagues = ["All", ...Array.from(new Set<string>(gameLog.map((g: any) => g.league).filter(Boolean) as string[])).sort()];

  const [selSeason, setSelSeason] = useState("All");
  const [selLeague, setSelLeague] = useState("All");
  const [selStat,   setSelStat]   = useState("pts");
  const [showInfo,  setShowInfo]  = useState(false);
  const [logView,   setLogView]   = useState("chart"); // "chart" | "table"

  const STAT_OPTIONS = [
    { key:"pts", label:"PTS", color:C.redBright },
    { key:"reb", label:"REB", color:C.textSub },
    { key:"ast", label:"AST", color:"#5ba4cf" },
    { key:"stl", label:"STL", color:C.green },
    { key:"blk", label:"BLK", color:"#a29bfe" },
    { key:"eff", label:"EFF", color:"#fdcb6e" },
  ];

  const filtered = gameLog
    .filter((g: any) => (selSeason === "All" || g.season === selSeason) && (selLeague === "All" || g.league === selLeague))
    .map((g: any, i: number) => ({ ...g, label: `G${i + 1}` }));

  const activeStat = STAT_OPTIONS.find(o => o.key === selStat);

  const radarData = [
    { stat:"Scoring",    value: Math.min(100, Math.round((s.ppg / 20) * 100)) },
    { stat:"Rebounds",   value: Math.min(100, Math.round((s.rpg / 10) * 100)) },
    { stat:"Assists",    value: Math.min(100, Math.round((s.apg / 6)  * 100)) },
    { stat:"STL+BLK",   value: Math.min(100, Math.round(((s.spg + s.bpg) / 5) * 100)) },
    { stat:"Shooting",   value: Math.min(100, Math.round(s.fgPct)) },
    { stat:"Efficiency", value: Math.min(100, Math.round((s.eff / 20) * 100)) },
  ];

  const filterBtnStyle = (active: any) => ({
    padding:"3px 10px", fontSize:10, fontWeight:900, letterSpacing:"0.1em",
    borderRadius:6, border:`1px solid ${active ? `${C.redBright}60` : C.border}`,
    background: active ? `${C.red}25` : "transparent",
    color: active ? C.redText : C.textDim,
    cursor:"pointer", fontFamily:"inherit",
  });

  const statBtnStyle = (key: any, color: any) => ({
    padding:"3px 10px", fontSize:10, fontWeight:900, letterSpacing:"0.1em",
    borderRadius:6, border:`1px solid ${selStat === key ? `${color}80` : C.border}`,
    background: selStat === key ? `${color}20` : "transparent",
    color: selStat === key ? color : C.textDim,
    cursor:"pointer", fontFamily:"inherit",
  });

  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, overflowY:"auto", padding:"80px 16px 32px", background:"rgba(10,10,10,0.88)", backdropFilter:"blur(6px)" }} onClick={onClose}>
      <div style={{ maxWidth:680, margin:"0 auto", borderRadius:16, overflow:"hidden", border:`1px solid ${C.border2}`, background:C.surface }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:24, display:"flex", gap:20, alignItems:"center", background:C.base, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ width:72, height:72, borderRadius:14, overflow:"hidden", flexShrink:0, background:C.surface, border:`1px solid ${C.border2}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>
            {playerImg(player) ? <img src={playerImg(player)} alt={player.name} style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top" }} /> : "🏀"}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:22, fontWeight:900, color:C.text }}>{player.name}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:8 }}>
              <span style={{ fontSize:11, fontWeight:900, letterSpacing:"0.12em", borderRadius:99, padding:"3px 12px", color:C.redText, background:`${C.red}20`, border:`1px solid ${C.redBright}40` }}>#{player.number}</span>
              <span style={{ fontSize:11, fontWeight:700, color:C.textSub }}>{player.position}</span>
              {player.height && <span style={{ fontSize:11, color:C.textDim }}>{player.height}</span>}
              {player.age && <span style={{ fontSize:11, color:C.textDim }}>Age {player.age}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize:28, fontWeight:900, color:C.textDim, background:"none", border:"none", cursor:"pointer", alignSelf:"flex-start" }}>×</button>
        </div>

        <div style={{ padding:24 }}>
          {/* Season averages */}
          {s.ppg > 0 && (
            <>
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:12, textTransform:"uppercase" }}>Season Averages</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:24 }}>
                <StatCell label="PPG" value={s.ppg} highlight />
                <StatCell label="RPG" value={s.rpg} />
                <StatCell label="ORB" value={s.orpg ?? 0} />
                <StatCell label="DRB" value={s.drpg ?? 0} />
                <StatCell label="APG" value={s.apg} />
                <StatCell label="SPG" value={s.spg} />
                <StatCell label="BPG" value={s.bpg} />
                <StatCell label="TPG" value={s.tpg} />
                <StatCell label="FPG" value={s.fpg ?? 0} />
                <StatCell label="FG%"  value={s.fgPct > 0 ? `${s.fgPct}%` : "—"} />
                <StatCell label="2P%"  value={s.fg2Pct > 0 ? `${s.fg2Pct}%` : "—"} />
                <StatCell label="3P%"  value={s.fg3Pct > 0 ? `${s.fg3Pct}%` : "—"} />
                <StatCell label="FT"   value={s.ftaPg > 0 ? `${s.ftmPg}/${s.ftaPg}` : "—"} />
                <StatCell label="FT%"  value={s.ftPct > 0 ? `${s.ftPct}%` : "—"} />
                <StatCell label="MPG"  value={s.mpg > 0 ? fmtMinutes(s.mpg) : "—"} />
                <StatCell label="EFF"  value={s.eff} highlight />
              </div>
            </>
          )}

          {/* Season-by-season breakdown (all-time view only) */}
          {activeSeason === "all-time" && player.seasonHistory && Object.keys(player.seasonHistory).length > 1 && (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:12, textTransform:"uppercase" }}>Season by Season</div>
              <div style={{ borderRadius:10, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr style={{ background:C.base }}>
                      {["Season","GP","PPG","RPG","APG","FG%","EFF"].map(h => (
                        <th key={h} style={{ padding:"6px 10px", textAlign: h === "Season" ? "left" : "center", fontWeight:900, letterSpacing:"0.1em", color:C.textDim, borderBottom:`1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(player.seasonHistory as Record<string, any>).sort((a,b) => b[0].localeCompare(a[0])).map(([sid, ss], i) => (
                      <tr key={sid} style={{ background: i % 2 === 0 ? C.surface : C.base }}>
                        <td style={{ padding:"6px 10px", fontWeight:700, color:C.textSub }}>{sid.replace(/-/g,"–")}</td>
                        <td style={{ padding:"6px 10px", textAlign:"center", color:C.textDim }}>{ss.gp}</td>
                        <td style={{ padding:"6px 10px", textAlign:"center", fontWeight:900, color:C.redText }}>{ss.ppg}</td>
                        <td style={{ padding:"6px 10px", textAlign:"center", color:C.text }}>{ss.rpg}</td>
                        <td style={{ padding:"6px 10px", textAlign:"center", color:C.text }}>{ss.apg}</td>
                        <td style={{ padding:"6px 10px", textAlign:"center", color:C.text }}>{ss.fgPct > 0 ? `${ss.fgPct}%` : "—"}</td>
                        <td style={{ padding:"6px 10px", textAlign:"center", fontWeight:900, color:C.gold }}>{ss.eff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Charts */}
          {s.ppg > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:16 }}>
              <div>
                {/* Skill Profile heading with ⓘ toggle */}
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase" }}>Skill Profile</div>
                  <button
                    onClick={() => setShowInfo(v => !v)}
                    style={{
                      width:16, height:16, borderRadius:"50%", border:`1px solid ${C.border2}`,
                      background: showInfo ? `${C.red}25` : "transparent",
                      color: showInfo ? C.redText : C.textDim,
                      fontSize:10, fontWeight:900, cursor:"pointer",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      lineHeight:1, padding:0, fontFamily:"inherit",
                    }}
                    title="How is this calculated?"
                  >ⓘ</button>
                </div>

                {/* Info panel */}
                {showInfo && (
                  <div style={{
                    marginBottom:8, padding:"8px 12px", borderRadius:8,
                    border:`1px solid ${C.border}`, background:C.base,
                    fontSize:11, color:C.textSub, lineHeight:1.6,
                  }}>
                    Each axis is scored 0–100 against a ceiling set for this level of gameplay: 20 PPG · 10 RPG · 6 APG · 5 STL+BLK · FG% direct · 20 EFF
                  </div>
                )}

                <div style={{ borderRadius:12, border:`1px solid ${C.border}`, padding:8, background:C.base }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData} margin={{ top:10, right:20, bottom:10, left:20 }}>
                      <PolarGrid stroke={C.border2} />
                      <PolarAngleAxis dataKey="stat" tick={{ fill:C.textSub, fontSize:10, fontWeight:700 }} />
                      <Radar dataKey="value" stroke={C.redBright} fill={C.red} fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {gameLog.length > 0 && (
                <div>
                  {/* Chart header + view toggle */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6, flexWrap:"wrap", gap:6 }}>
                    <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase" }}>
                      Game Log {filtered.length > 0 ? `(${filtered.length})` : ""}
                    </div>
                    <div style={{ display:"flex", gap:4 }}>
                      {["chart","table"].map(v => (
                        <button key={v} onClick={() => setLogView(v)} style={{
                          padding:"2px 9px", fontSize:10, fontWeight:900, letterSpacing:"0.08em", borderRadius:5,
                          border:`1px solid ${logView === v ? `${C.redBright}60` : C.border}`,
                          background: logView === v ? `${C.red}25` : "transparent",
                          color: logView === v ? C.redText : C.textDim,
                          cursor:"pointer", fontFamily:"inherit", textTransform:"uppercase",
                        }}>{v}</button>
                      ))}
                    </div>
                  </div>

                  {/* Season filter */}
                  {seasons.length > 2 && (
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6 }}>
                      {seasons.map(s => (
                        <button key={s} style={filterBtnStyle(selSeason === s)} onClick={() => setSelSeason(s)}>{s}</button>
                      ))}
                    </div>
                  )}

                  {/* League filter */}
                  {leagues.length > 2 && (
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6 }}>
                      {leagues.map(l => (
                        <button key={l} style={filterBtnStyle(selLeague === l)} onClick={() => setSelLeague(l)}>
                          {l === "rookie" ? "Rookie" : l === "bc6" ? "BC6" : l === "wintercup" ? "Winter Cup" : l}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Stat selector */}
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6 }}>
                    {STAT_OPTIONS.map(o => (
                      <button key={o.key} style={statBtnStyle(o.key, o.color)} onClick={() => setSelStat(o.key)}>{o.label}</button>
                    ))}
                  </div>

                  {logView === "chart" ? (
                    <div style={{ borderRadius:12, border:`1px solid ${C.border}`, padding:8, background:C.base }}>
                      {filtered.length === 0 ? (
                        <div style={{ height:200, display:"flex", alignItems:"center", justifyContent:"center", color:C.textDim, fontSize:12 }}>No games match this filter</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={filtered} margin={{ top:8, right:4, left:-24, bottom:0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="label" tick={{ fill:C.textDim, fontSize:10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill:C.textDim, fontSize:10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                              {...chartTooltipStyle}
                              formatter={(val) => [val, activeStat?.label]}
                              labelFormatter={(label, payload) => {
                                const g = payload?.[0]?.payload;
                                return g ? `${label} vs ${g.opponent}` : label;
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey={selStat}
                              stroke={activeStat?.color || C.redBright}
                              strokeWidth={2}
                              dot={{ fill: activeStat?.color || C.redBright, r:3 }}
                              name={activeStat?.label}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  ) : (
                    <div style={{ borderRadius:12, border:`1px solid ${C.border}`, background:C.base, overflow:"hidden" }}>
                      {filtered.length === 0 ? (
                        <div style={{ height:80, display:"flex", alignItems:"center", justifyContent:"center", color:C.textDim, fontSize:12 }}>No games match this filter</div>
                      ) : (
                        <div style={{ overflowY:"auto", maxHeight:260 }}>
                          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                            <thead style={{ position:"sticky", top:0, background:C.surface2, zIndex:1 }}>
                              <tr>
                                {["#","Date","vs","MIN","PTS","REB","AST","STL","BLK","FT","EFF"].map(h => (
                                  <th key={h} style={{ padding:"5px 7px", textAlign: h === "vs" || h === "Date" ? "left" : "center", fontWeight:900, letterSpacing:"0.08em", color:C.textDim, borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map((g: any, i: number) => (
                                <tr key={g.gameId || i} style={{ background: i % 2 === 0 ? C.base : "transparent", borderBottom:`1px solid ${C.border}` }}>
                                  <td style={{ padding:"5px 7px", textAlign:"center", color:C.textDim, fontWeight:700 }}>{i+1}</td>
                                  <td style={{ padding:"5px 7px", color:C.textDim, whiteSpace:"nowrap" }}>{g.date ? g.date.slice(5) : "—"}</td>
                                  <td style={{ padding:"5px 7px", color:C.textSub, maxWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.opponent || "—"}</td>
                                  <td style={{ padding:"5px 7px", textAlign:"center", color:C.textDim }}>{g.min || "—"}</td>
                                  <td style={{ padding:"5px 7px", textAlign:"center", fontWeight:900, color:C.redText }}>{g.pts}</td>
                                  <td style={{ padding:"5px 7px", textAlign:"center", color:C.text }}>{g.reb}</td>
                                  <td style={{ padding:"5px 7px", textAlign:"center", color:C.text }}>{g.ast}</td>
                                  <td style={{ padding:"5px 7px", textAlign:"center", color:C.text }}>{g.stl}</td>
                                  <td style={{ padding:"5px 7px", textAlign:"center", color:C.text }}>{g.blk}</td>
                                  <td style={{ padding:"5px 7px", textAlign:"center", color:C.text, whiteSpace:"nowrap" }}>{g.fta > 0 ? `${g.ftm}/${g.fta}` : "—"}</td>
                                  <td style={{ padding:"5px 7px", textAlign:"center", fontWeight:900, color:C.gold }}>{g.eff}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {s.ppg === 0 && (
            <div style={{ textAlign:"center", padding:"24px 0", color:C.textDim }}>
              <div style={{ fontSize:13 }}>No stats recorded yet for this player.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ player, onClick }: any) {
  const [hov, setHov] = useState(false);
  const s = player.stats;
  const hasStats = s.gp > 0;
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      borderRadius:12, overflow:"hidden", textAlign:"left", width:"100%", cursor:"pointer",
      border:`1px solid ${hov ? `${C.redBright}55` : C.border}`,
      background:C.surface, boxShadow: hov ? `0 8px 32px ${C.red}30` : "none",
      transition:"all 0.2s", fontFamily:"inherit",
      opacity: hasStats ? 1 : 0.55,
    }}>
      <div style={{ height:170, display:"flex", alignItems:"flex-end", justifyContent:"center", background:C.base, position:"relative" }}>
        {playerImg(player)
          ? <img src={playerImg(player)} alt={player.name} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"top", borderRadius:0 }} />
          : <span style={{ fontSize:52, lineHeight:1, paddingBottom:12, zIndex:1, position:"relative" }}>🏀</span>
        }
        {/* gradient overlay */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:64, background:"linear-gradient(to bottom, transparent, rgba(28,28,30,0.9))", zIndex:1, pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:10, right:10, width:26, height:26, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, background:C.red, color:C.text, zIndex:2 }}>{player.number}</div>
        {hasStats && (
          <div style={{ position:"absolute", bottom:8, left:10, fontSize:10, fontWeight:900, letterSpacing:"0.1em", color:C.textSub, background:"rgba(28,28,30,0.7)", borderRadius:6, padding:"2px 7px", zIndex:2 }}>{s.gp} GP</div>
        )}
      </div>
      <div style={{ padding:14 }}>
        <div style={{ fontSize:13, fontWeight:900, color: hov ? C.redText : C.text, transition:"color 0.2s", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fmt(player.name)}</div>
        <div style={{ marginTop:6 }}>
          <span style={{ fontSize:10, fontWeight:900, letterSpacing:"0.12em", borderRadius:99, padding:"2px 8px", color:C.textSub, background:C.surface2, border:`1px solid ${C.border2}` }}>{player.position}</span>
        </div>
        <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
          {hasStats ? (
            <div style={{ display:"flex", gap:0 }}>
              {[["PPG",s.ppg],["RPG",s.rpg],["APG",s.apg],["EFF",s.eff]].map(([l,v]) => (
                <div key={l} style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.12em", color:C.textDim }}>{l}</div>
                  <div style={{ fontSize:14, fontWeight:900, color: l === "EFF" ? C.gold : C.text, marginTop:2 }}>{v}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign:"center", fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:C.textDim, padding:"4px 0" }}>NO STATS YET</div>
          )}
        </div>
      </div>
      <div style={{ height:2, background:C.redBright, transform: hov ? "scaleX(1)" : "scaleX(0)", transformOrigin:"left", transition:"transform 0.3s" }} />
    </button>
  );
}

export default function PlayersPage({ players, statsMap, seasons, currentSeason, allTimeStatsMap, playerSeasonHistory }: any) {
  const router = useRouter();
  const [selected, setSelected] = useState<any>(null);
  const [activeSeason, setActiveSeason] = useState(currentSeason);
  const [search, setSearch] = useState("");

  // Merge bio + stats for the active season (or all-time)
  const activeStatsMap = activeSeason === "all-time" ? allTimeStatsMap : statsMap;
  const playersWithStats = players.map((p: any) => ({
    ...p,
    stats:          activeStatsMap[p.id] ?? { ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,ftmPg:0,ftaPg:0,mpg:0,eff:0,gp:0 },
    gameLog:        activeStatsMap[p.id]?.gameLog ?? [],
    seasonHistory:  playerSeasonHistory?.[p.id] ?? {},
  }));

  // Auto-open player detail when navigated from another page (e.g. leaderboard row click)
  useEffect(() => {
    const { player: playerId } = router.query;
    if (!playerId || playersWithStats.length === 0) return;
    const found = playersWithStats.find((p: any) => p.id === playerId);
    if (found) setSelected(found);
  }, [router.query.player, playersWithStats.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...playersWithStats].sort((a, b) => Number(a.number) - Number(b.number));
  const displayed = search.trim()
    ? sorted.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : sorted;

  return (
    <Layout title="Players">
      <SectionHeading label="2025–26 Season" title="Players" />
      <SeasonSelector
        seasons={seasons}
        currentSeason={activeSeason}
        onChange={sid => { setActiveSeason(sid); setSelected(null); setSearch(""); }}
        showAllTime={true}
        right={`${players.length} Players`}
      />
      <div style={{ marginBottom:16 }}>
        <input
          type="text"
          placeholder="Search players…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width:"100%", maxWidth:260, padding:"7px 14px", borderRadius:8,
            border:`1px solid ${C.border2}`, background:C.surface2, color:C.text,
            fontSize:12, fontFamily:"inherit", outline:"none",
          }}
        />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))", gap:14 }}>
        {displayed.map(p => <PlayerCard key={p.id} player={p} onClick={() => setSelected(p)} />)}
      </div>
      {selected && <PlayerDetail player={selected} onClose={() => setSelected(null)} activeSeason={activeSeason} />}
    </Layout>
  );
}

export async function getStaticProps() {
  const { seasons, currentSeason, players, stats } = await getAllPublicData(null);
  const allSeasonsStats = await getAllSeasonsStats(seasons);
  const allTimeStatsMap = buildAllTimeStatsMap(allSeasonsStats, players);

  // Build per-player season history: { [pid]: { [seasonId]: SeasonStats } }
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

  return { props: { players, statsMap: stats, seasons, currentSeason, allTimeStatsMap, playerSeasonHistory }, revalidate: 3600 };
}
