import { useState } from "react";
import Layout from "../components/Layout";
import { SectionHeading } from "../components/ui";
import { C, chartTooltipStyle } from "../lib/theme";
import { getAllPublicData, getAllSeasonsStats } from "../lib/data";
import { buildAllTimeStatsMap } from "../lib/stats";
import { fmt } from "../lib/utils";
import SeasonSelector from "../components/SeasonSelector";
import ErrorBoundary from "../components/ErrorBoundary";
import { LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "../components/Charts";


// Player photos come from the photoUrl field in the database.
// Falls back to null (shows 🏀 emoji) if not set.
const playerImg = (player) => player.photoUrl || null;

function StatCell({ label, value, highlight }) {
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

function PlayerDetail({ player, onClose }) {
  const s = player.stats;
  const gameLog = player.gameLog || [];

  // Derive available seasons and leagues from gameLog
  const seasons = ["All", ...Array.from(new Set(gameLog.map(g => g.season).filter(Boolean))).sort().reverse()];
  const leagues = ["All", ...Array.from(new Set(gameLog.map(g => g.league).filter(Boolean))).sort()];

  const [selSeason, setSelSeason] = useState("All");
  const [selLeague, setSelLeague] = useState("All");
  const [selStat,   setSelStat]   = useState("pts");
  const [showInfo,  setShowInfo]  = useState(false);

  const STAT_OPTIONS = [
    { key:"pts", label:"PTS", color:C.redBright },
    { key:"reb", label:"REB", color:C.textSub },
    { key:"ast", label:"AST", color:"#5ba4cf" },
    { key:"stl", label:"STL", color:C.green },
    { key:"blk", label:"BLK", color:"#a29bfe" },
    { key:"eff", label:"EFF", color:"#fdcb6e" },
  ];

  const filtered = gameLog
    .filter(g => (selSeason === "All" || g.season === selSeason) && (selLeague === "All" || g.league === selLeague))
    .map((g, i) => ({ ...g, label: `G${i + 1}` }));

  const activeStat = STAT_OPTIONS.find(o => o.key === selStat);

  const radarData = [
    { stat:"Scoring",    value: Math.min(100, Math.round((s.ppg / 20) * 100)) },
    { stat:"Rebounds",   value: Math.min(100, Math.round((s.rpg / 10) * 100)) },
    { stat:"Assists",    value: Math.min(100, Math.round((s.apg / 6)  * 100)) },
    { stat:"STL+BLK",   value: Math.min(100, Math.round(((s.spg + s.bpg) / 5) * 100)) },
    { stat:"Shooting",   value: Math.min(100, Math.round(s.fgPct)) },
    { stat:"Efficiency", value: Math.min(100, Math.round((s.eff / 20) * 100)) },
  ];

  const filterBtnStyle = (active) => ({
    padding:"3px 10px", fontSize:10, fontWeight:900, letterSpacing:"0.1em",
    borderRadius:6, border:`1px solid ${active ? `${C.redBright}60` : C.border}`,
    background: active ? `${C.red}25` : "transparent",
    color: active ? C.redText : C.textDim,
    cursor:"pointer", fontFamily:"inherit",
  });

  const statBtnStyle = (key, color) => ({
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
                <StatCell label="FG%"  value={s.fgPct > 0 ? `${s.fgPct}%` : "--"} />
                <StatCell label="2P%"  value={s.fg2Pct > 0 ? `${s.fg2Pct}%` : "--"} />
                <StatCell label="3P%"  value={s.fg3Pct > 0 ? `${s.fg3Pct}%` : "--"} />
                <StatCell label="FT%"  value={s.ftPct !== null && s.ftPct !== undefined ? `${s.ftPct}%` : "--"} />
                <StatCell label="MPG"  value={s.mpg} />
                <StatCell label="EFF"  value={s.eff} highlight />
              </div>
            </>
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
                    Each axis is scored 0-100 against a ceiling set for this level of gameplay: 20 PPG · 10 RPG · 6 APG · 5 STL+BLK · FG% direct · 20 EFF
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
                  {/* Chart header + stat selector */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6, flexWrap:"wrap", gap:6 }}>
                    <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase" }}>
                      Game Log {filtered.length > 0 ? `(${filtered.length})` : ""}
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

function PlayerCard({ player, onClick }) {
  const [hov, setHov] = useState(false);
  const s = player.stats;
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      borderRadius:12, overflow:"hidden", textAlign:"left", width:"100%", cursor:"pointer",
      border:`1px solid ${hov ? `${C.redBright}55` : C.border}`,
      background:C.surface, boxShadow: hov ? `0 8px 32px ${C.red}30` : "none",
      transition:"all 0.2s", fontFamily:"inherit",
    }}>
      <div style={{ height:100, display:"flex", alignItems:"flex-end", justifyContent:"center", background:C.base, position:"relative" }}>
        {playerImg(player)
          ? <img src={playerImg(player)} alt={player.name} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"top", borderRadius:0 }} />
          : <span style={{ fontSize:48, lineHeight:1, paddingBottom:8 }}>🏀</span>
        }
        <div style={{ position:"absolute", top:10, right:10, width:26, height:26, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, background:C.red, color:C.text, zIndex:1 }}>{player.number}</div>
      </div>
      <div style={{ padding:14 }}>
        <div style={{ fontSize:13, fontWeight:900, color: hov ? C.redText : C.text, transition:"color 0.2s" }}>{fmt(player.name)}</div>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:C.textDim, marginTop:2 }}>{player.position}</div>
        <div style={{ display:"flex", gap:0, marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
          {[["PPG",s.ppg],["RPG",s.rpg],["APG",s.apg]].map(([l,v]) => (
            <div key={l} style={{ flex:1, textAlign:"center" }}>
              <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.12em", color:C.textDim }}>{l}</div>
              <div style={{ fontSize:15, fontWeight:900, color:C.text, marginTop:2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height:2, background:C.redBright, transform: hov ? "scaleX(1)" : "scaleX(0)", transformOrigin:"left", transition:"transform 0.3s" }} />
    </button>
  );
}

export default function PlayersPage({ players, statsMap, seasons, currentSeason, allTimeStatsMap }) {
  const [selected, setSelected] = useState(null);
  const [activeSeason, setActiveSeason] = useState(currentSeason);

  // Merge bio + stats for the active season (or all-time)
  const activeStatsMap = activeSeason === "all-time" ? allTimeStatsMap : statsMap;
  const playersWithStats = players.map(p => ({
    ...p,
    stats:   activeStatsMap[p.id] ?? { ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0,gp:0 },
    gameLog: activeStatsMap[p.id]?.gameLog ?? [],
  }));

  const sorted = [...playersWithStats].sort((a, b) => Number(a.number) - Number(b.number));

  return (
    <Layout title="Players">
      <SectionHeading label="2025-26 Season" title="Roster" right={`${players.length} Players`} />
      <SeasonSelector
        seasons={seasons}
        currentSeason={activeSeason}
        onChange={sid => { setActiveSeason(sid); setSelected(null); }}
        showAllTime={true}
      />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:14 }}>
        {sorted.map(p => <PlayerCard key={p.id} player={p} onClick={() => setSelected(p)} />)}
      </div>
      {selected && <PlayerDetail player={selected} onClose={() => setSelected(null)} seasons={seasons} />}
    </Layout>
  );
}

export async function getStaticProps() {
  const { seasons, currentSeason, players, stats } = await getAllPublicData(null);
  const allSeasonsStats = await getAllSeasonsStats(seasons);
  const allTimeStatsMap = buildAllTimeStatsMap(allSeasonsStats, players);
  return { props: { players, statsMap: stats, seasons, currentSeason, allTimeStatsMap }, revalidate: 3600 };
}
