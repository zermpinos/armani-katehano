import Layout from "../components/Layout";
import { SectionHeading, StatTile } from "../components/ui";
import { C, chartTooltipStyle } from "../lib/theme";
import { getAllPublicData } from "../lib/data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function TeamPage({ record, players, games }) {
  const gp = games.length;

  // Aggregate from all box scores
  const allRows = games.flatMap(g => g.boxScore || []).filter(r => r.min > 0);
  const sum = key => allRows.reduce((a, r) => a + (r[key] || 0), 0);
  const avg = (key, n = gp) => n > 0 ? +(sum(key) / n).toFixed(1) : 0;
  const pct  = (m, a) => { const t = sum(a); return t > 0 ? +(sum(m) / t * 100).toFixed(1) : 0; };

  const teamAvg = {
    ppg:    avg("pts"), rpg: avg("reb"), apg: avg("ast"),
    spg:    avg("stl"), bpg: avg("blk"), tpg: avg("tov"),
    fgPct:  pct("fgm","fga"), fg3Pct: pct("fg3m","fg3a"), ftPct: pct("ftm","fta"),
  };

  // Win/loss split
  const wins   = games.filter(g => g.result === "W").length;
  const losses = games.filter(g => g.result === "L").length;
  const homeW  = games.filter(g => g.home && g.result==="W").length;
  const homeL  = games.filter(g => g.home && g.result==="L").length;
  const awayW  = games.filter(g => !g.home && g.result==="W").length;
  const awayL  = games.filter(g => !g.home && g.result==="L").length;

  // Per-player minutes distribution
  const minutesDist = players
    .map(p => ({
      name: p.name.split(" ").slice(-1)[0],
      mpg: p.stats.mpg,
    }))
    .filter(p => p.mpg > 0)
    .sort((a, b) => b.mpg - a.mpg);

  if (gp === 0) {
    return (
      <Layout title="Team Stats">
        <SectionHeading label="2025-26 Season" title="Team Stats" />
        <div style={{ textAlign:"center", padding:48, color:C.textDim }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
          <div style={{ fontSize:15, fontWeight:700 }}>No data yet</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Team Stats">
      <SectionHeading label="2025-26 Season" title="Team Stats" right={`${gp} games played`} />

      {/* Key averages */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:24 }}>
        <StatTile label="PPG"  value={teamAvg.ppg}  sub="per game" highlight />
        <StatTile label="RPG"  value={teamAvg.rpg}  sub="per game" />
        <StatTile label="APG"  value={teamAvg.apg}  sub="per game" />
        <StatTile label="SPG"  value={teamAvg.spg}  sub="per game" />
        <StatTile label="BPG"  value={teamAvg.bpg}  sub="per game" />
        <StatTile label="TOV"  value={teamAvg.tpg}  sub="per game" />
        <StatTile label="FG%"  value={`${teamAvg.fgPct}%`}  sub="field goal" />
        <StatTile label="3P%"  value={`${teamAvg.fg3Pct}%`} sub="three-point" />
        <StatTile label="FT%"  value={`${teamAvg.ftPct}%`}  sub="free throw" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:20, marginBottom:20 }}>
        {/* Record breakdown */}
        <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
          <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>Record Breakdown</div>
          {[
            ["Overall",    wins,  losses],
            ["Home",       homeW, homeL],
            ["Away",       awayW, awayL],
          ].map(([label, w, l]) => (
            <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <span style={{ fontSize:13, fontWeight:700, color:C.textSub }}>{label}</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16, fontWeight:900, color:C.text }}>{w}-{l}</span>
                <span style={{ fontSize:11, color:C.textDim }}>{w+l > 0 ? `${(w/(w+l)*100).toFixed(0)}%` : "--"}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Shooting */}
        <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
          <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>Shooting Splits</div>
          {[
            ["Field Goals",    teamAvg.fgPct, pct("fgm","fga")],
            ["3-Pointers",     teamAvg.fg3Pct],
            ["Free Throws",    teamAvg.ftPct],
          ].map(([label, val]) => (
            <div key={label} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.textSub }}>{label}</span>
                <span style={{ fontSize:13, fontWeight:900, color:C.text }}>{val}%</span>
              </div>
              <div style={{ height:4, borderRadius:2, background:C.border }}>
                <div style={{ height:"100%", borderRadius:2, background:C.redBright, width:`${Math.min(100,val)}%`, transition:"width 0.4s" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Minutes distribution */}
      {minutesDist.length > 0 && (
        <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
          <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>Minutes Distribution (MPG)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={minutesDist} margin={{ top:4, right:8, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fill:C.textSub, fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:C.textDim, fontSize:11 }} axisLine={false} tickLine={false} domain={[0,40]} />
              <Tooltip {...chartTooltipStyle} formatter={v => [`${v} min`]} />
              <Bar dataKey="mpg" fill={C.red} radius={[4,4,0,0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Layout>
  );
}

export async function getServerSideProps() {
  const { record, players, games } = await getAllPublicData();
  return { props: { record, players, games } };
}
