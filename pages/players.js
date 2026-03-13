import { useState } from "react";
import Layout from "../components/Layout";
import { SectionHeading } from "../components/ui";
import { C, chartTooltipStyle } from "../lib/theme";
import { getAllPublicData } from "../lib/data";
import {
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";


// "Last Name F." format
// Names stored as "First Last" → display as "Last F."
const fmt = name => {
  if (!name) return "";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last  = parts[parts.length - 1];
  return last + " " + first[0].toUpperCase() + ".";
};

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
  const radarData = [
    { stat:"Scoring",    value: Math.min(100, Math.round((s.ppg / 18) * 100)) },
    { stat:"Rebounds",   value: Math.min(100, Math.round((s.rpg / 11) * 100)) },
    { stat:"Assists",    value: Math.min(100, Math.round((s.apg / 8)  * 100)) },
    { stat:"Defense",    value: Math.min(100, Math.round(((s.spg + s.bpg) / 3.5) * 100)) },
    { stat:"Shooting",   value: Math.min(100, Math.round(s.fgPct)) },
    { stat:"Efficiency", value: Math.min(100, Math.round((s.eff / 22) * 100)) },
  ];
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, overflowY:"auto", padding:"80px 16px 32px", background:"rgba(10,10,10,0.88)", backdropFilter:"blur(6px)" }} onClick={onClose}>
      <div style={{ maxWidth:680, margin:"0 auto", borderRadius:16, overflow:"hidden", border:`1px solid ${C.border2}`, background:C.surface }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:24, display:"flex", gap:20, alignItems:"center", background:C.base, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ width:72, height:72, borderRadius:14, overflow:"hidden", flexShrink:0, background:C.surface, border:`1px solid ${C.border2}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>
            {player.photoUrl ? <img src={player.photoUrl} alt={player.name} style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top" }} /> : "🏀"}
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
                <StatCell label="FG%"  value={`${s.fgPct}%`} />
                <StatCell label="2P%"  value={s.fg2Pct > 0 ? `${s.fg2Pct}%` : "—"} />
                <StatCell label="3P%"  value={s.fg3Pct > 0 ? `${s.fg3Pct}%` : "—"} />
                <StatCell label="FT%"  value={`${s.ftPct}%`} />
                <StatCell label="MPG"  value={s.mpg} />
                <StatCell label="EFF"  value={s.eff} highlight />
              </div>
            </>
          )}

          {/* Charts */}
          {s.ppg > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:16 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:8, textTransform:"uppercase" }}>Skill Profile</div>
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
              {player.gameLog?.length > 0 && (
                <div>
                  <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:8, textTransform:"uppercase" }}>Last {player.gameLog.length} Games</div>
                  <div style={{ borderRadius:12, border:`1px solid ${C.border}`, padding:8, background:C.base }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={player.gameLog} margin={{ top:8, right:4, left:-24, bottom:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="game" tick={{ fill:C.textDim, fontSize:10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill:C.textDim, fontSize:10 }} axisLine={false} tickLine={false} />
                        <Tooltip {...chartTooltipStyle} />
                        <Line type="monotone" dataKey="pts" stroke={C.redBright} strokeWidth={2} dot={{ fill:C.redBright, r:3 }} name="PTS" />
                        <Line type="monotone" dataKey="reb" stroke={C.textSub}   strokeWidth={1.5} dot={{ fill:C.textSub, r:2 }} name="REB" strokeDasharray="3 2" />
                        <Line type="monotone" dataKey="ast" stroke={C.textDim}   strokeWidth={1.5} dot={{ fill:C.textDim, r:2 }} name="AST" strokeDasharray="3 2" />
                        <Legend wrapperStyle={{ fontSize:10, color:C.textSub }} />
                      </LineChart>
                    </ResponsiveContainer>
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
        {player.photoUrl
          ? <img src={player.photoUrl} alt={player.name} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"top", borderRadius:0 }} />
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

export default function PlayersPage({ players }) {
  const [selected, setSelected] = useState(null);
  const sorted = [...players].sort((a, b) => Number(a.number) - Number(b.number));
  return (
    <Layout title="Players">
      <SectionHeading label="2025–26 Season" title="Roster" right={`${players.length} Players`} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:14 }}>
        {sorted.map(p => <PlayerCard key={p.id} player={p} onClick={() => setSelected(p)} />)}
      </div>
      {selected && <PlayerDetail player={selected} onClose={() => setSelected(null)} />}
    </Layout>
  );
}

export async function getServerSideProps() {
  const { players } = await getAllPublicData();
  return { props: { players } };
}
