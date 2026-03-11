import Layout from "../components/Layout";
import { StatTile, SectionHeading } from "../components/ui";
import { C, chartTooltipStyle } from "../lib/theme";
import { getAllPublicData, computeRecord } from "../lib/data";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// "First Last" → "Last F."
const fmt = name => {
  if (!name) return "";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 1] + " " + parts[0][0].toUpperCase() + ".";
};

export default function HomePage({ players, games }) {
  // Compute record live from games (never trust stale Redis record)
  const record = computeRecord(games);

  const winPct = record.wins + record.losses > 0
    ? (record.wins / (record.wins + record.losses) * 100).toFixed(1)
    : "0.0";

  const mvp = players.length
    ? players.reduce((b, p) => p.stats.eff > b.stats.eff ? p : b, players[0])
    : null;

  const topScorers = [...players]
    .sort((a, b) => b.stats.ppg - a.stats.ppg)
    .slice(0, 5)
    .map(p => ({ name: fmt(p.name), ppg: p.stats.ppg }));

  // Last 9 games for scoring trend
  const trend = [...games]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 9)
    .reverse()
    .map((g, i) => {
      const parts = (g.score || "0–0").split(/[–-]/);
      return {
        game:   `G${i + 1}`,
        pts:    parseInt(parts[0]) || 0,
        opp:    parseInt(parts[1]) || 0,
        result: g.result,
      };
    });

  const recentGames = [...games]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

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
        <StatTile label="PPG"     value={record.ppg || "—"} sub="points per game" />
        <StatTile label="OPP PPG" value={record.oppPpg || "—"} sub="allowed per game" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:20 }}>

          {/* Scoring trend */}
          {trend.length > 0 && (
            <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>Scoring Trend — Last {trend.length} Games</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trend} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="game" tick={{ fill:C.textDim, fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:C.textDim, fontSize:11 }} axisLine={false} tickLine={false} domain={["auto","auto"]} />
                  <Tooltip {...chartTooltipStyle} />
                  <Line type="monotone" dataKey="pts" stroke={C.redBright} strokeWidth={2.5} dot={{ fill:C.redBright, r:3 }} name="AK" />
                  <Line type="monotone" dataKey="opp" stroke={C.border2} strokeWidth={2} dot={{ fill:C.border2, r:3 }} name="OPP" strokeDasharray="4 2" />
                  <Legend wrapperStyle={{ fontSize:11, color:C.textSub }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top scorers */}
          {topScorers.some(p => p.ppg > 0) && (
            <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>Top Scorers — PPG</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={topScorers} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill:C.textSub, fontSize:11, fontWeight:700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:C.textDim, fontSize:11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...chartTooltipStyle} formatter={v => [`${v} PPG`]} />
                  <Bar dataKey="ppg" fill={C.red} radius={[4,4,0,0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20 }}>
          {/* MVP card */}
          {mvp && mvp.stats.eff > 0 && (
            <div style={{ borderRadius:12, padding:20, position:"relative", overflow:"hidden", border:`1px solid ${C.redBright}40`, background:C.surface }}>
              <div style={{ position:"absolute", top:0, right:0, width:140, height:140, borderRadius:"50%", background:`${C.red}12`, transform:"translate(40%,-40%)" }} />
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.redText, marginBottom:16, textTransform:"uppercase" }}>⚡ Efficiency Leader</div>
              <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
                <div style={{ width:60, height:60, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", background:C.base, border:`1px solid ${C.border2}`, flexShrink:0 }}>
                  <span style={{ fontSize:22 }}>🏀</span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:900, color:C.text }}>{fmt(mvp.name)}</div>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:C.textDim, marginTop:2 }}>#{mvp.number} · {mvp.position}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:12 }}>
                    {[["PPG",mvp.stats.ppg],["RPG",mvp.stats.rpg],["APG",mvp.stats.apg],["FG%",`${mvp.stats.fgPct}%`],["EFF",mvp.stats.eff],["MPG",mvp.stats.mpg]].map(([l,v]) => (
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

          {/* Recent results */}
          {recentGames.length > 0 && (
            <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>Recent Results</div>
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
                        <div style={{ fontSize:11, color:C.textDim }}>{g.date}</div>
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
      </div>

      {/* Empty state */}
      {games.length === 0 && players.every(p => p.stats.ppg === 0) && (
        <div style={{ textAlign:"center", padding:"48px 0", color:C.textDim }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏀</div>
          <div style={{ fontSize:15, fontWeight:700 }}>No data yet</div>
          <div style={{ fontSize:13, marginTop:4 }}>Add games via the admin panel to see stats here.</div>
        </div>
      )}
    </Layout>
  );
}

export async function getServerSideProps() {
  const { players, games } = await getAllPublicData();
  return { props: { players, games } };
}
