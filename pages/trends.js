import { useState } from "react";
import Layout from "../components/Layout";
import { SectionHeading } from "../components/ui";
import { C, chartTooltipStyle } from "../lib/theme";
import { getAllPublicData } from "../lib/data";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar,
} from "recharts";

const COLORS = [C.redBright, "#4caf7d", "#5b8dee", "#f0c040", "#e07b54", "#9b59b6", "#1abc9c", "#e74c3c", "#3498db", "#f39c12", "#2ecc71", "#8e44ad", "#16a085"];

export default function TrendsPage({ players, games }) {
  const [statKey, setStatKey] = useState("pts");
  const [mode, setMode]       = useState("team"); // "team" | "player"
  const [selectedPlayer, setSelectedPlayer] = useState(players[0]?.id ?? null);

  const STAT_OPTIONS = [
    { value:"pts", label:"Points" }, { value:"reb", label:"Rebounds" },
    { value:"ast", label:"Assists" }, { value:"stl", label:"Steals" },
    { value:"blk", label:"Blocks" }, { value:"eff", label:"Efficiency" },
  ];

  // Sort games chronologically
  const sortedGames = [...games].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Team scoring trend per game
  const teamTrend = sortedGames.map((g, i) => {
    const parts = (g.score || "0-0").split(/[--]/);
    return { game:`G${i+1}`, label: g.opponent, pts: parseInt(parts[0])||0, opp: parseInt(parts[1])||0 };
  });

  // Per-player trend for selected stat across games
  const playerTrendData = (() => {
    if (mode !== "player") return [];
    const pl = players.find(p => p.id === selectedPlayer);
    if (!pl) return [];
    return sortedGames.map((g, i) => {
      const row = (g.boxScore || []).find(r => r.pid === pl.id);
      return { game:`G${i+1}`, value: row?.[statKey] ?? 0 };
    });
  })();

  // Multi-player comparison for selected stat (season averages)
  const comparisonData = players
    .filter(p => {
      const statMap = { pts:"ppg", reb:"rpg", ast:"apg", stl:"spg", blk:"bpg", eff:"eff" };
      return (p.stats[statMap[statKey]] ?? 0) > 0;
    })
    .sort((a, b) => {
      const statMap = { pts:"ppg", reb:"rpg", ast:"apg", stl:"spg", blk:"bpg", eff:"eff" };
      return b.stats[statMap[statKey]] - a.stats[statMap[statKey]];
    })
    .map(p => {
      const statMap = { pts:"ppg", reb:"rpg", ast:"apg", stl:"spg", blk:"bpg", eff:"eff" };
      const nameParts = p.name.trim().split(" ").filter(Boolean);
      const label = nameParts.length > 1
        ? nameParts[nameParts.length - 1] + " " + nameParts[0][0].toUpperCase() + "."
        : nameParts[0] || p.name;
      return { name: label, value: p.stats[statMap[statKey]] };
    });

  if (games.length === 0) {
    return (
      <Layout title="Stats Trends">
        <SectionHeading label="2025-26 Season" title="Stats Trends" />
        <div style={{ textAlign:"center", padding:48, color:C.textDim }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📈</div>
          <div style={{ fontSize:15, fontWeight:700 }}>No data yet</div>
          <div style={{ fontSize:13, marginTop:4 }}>Add games to see trends.</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Stats Trends">
      <SectionHeading label="2025-26 Season" title="Stats Trends" />

      {/* Controls */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:24, alignItems:"center" }}>
        <div style={{ display:"flex", gap:6 }}>
          {["team","player"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding:"6px 14px", fontSize:11, fontWeight:900, letterSpacing:"0.12em",
              borderRadius:8, border:`1px solid ${mode===m ? C.redBright : C.border2}`,
              background: mode===m ? `${C.red}25` : "transparent",
              color: mode===m ? C.redText : C.textDim, cursor:"pointer", fontFamily:"inherit",
              textTransform:"uppercase",
            }}>{m}</button>
          ))}
        </div>
        <select value={statKey} onChange={e => setStatKey(e.target.value)} style={{
          padding:"6px 12px", fontSize:12, borderRadius:8,
          border:`1px solid ${C.border2}`, background:C.base, color:C.text, fontFamily:"inherit",
        }}>
          {STAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {mode==="player" && (
          <select value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)} style={{
            padding:"6px 12px", fontSize:12, borderRadius:8,
            border:`1px solid ${C.border2}`, background:C.base, color:C.text, fontFamily:"inherit",
          }}>
            {players.sort((a,b)=>Number(a.number)-Number(b.number)).map(p => (
              <option key={p.id} value={p.id}>#{p.number} {p.name}</option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display:"grid", gap:20 }}>
        {/* Team scoring trend */}
        {mode === "team" && (
          <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
            <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>Team Scoring -- All Games</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={teamTrend} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="game" tick={{ fill:C.textDim, fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:C.textDim, fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltipStyle} />
                <Line type="monotone" dataKey="pts" stroke={C.redBright} strokeWidth={2.5} dot={{ fill:C.redBright, r:3 }} name="AK" />
                <Line type="monotone" dataKey="opp" stroke={C.border2} strokeWidth={2} dot={{ fill:C.border2, r:3 }} name="OPP" strokeDasharray="4 2" />
                <Legend wrapperStyle={{ fontSize:11, color:C.textSub }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Player game-by-game trend */}
        {mode === "player" && playerTrendData.length > 0 && (
          <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
            <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>
              {players.find(p=>p.id===selectedPlayer)?.name} -- {STAT_OPTIONS.find(o=>o.value===statKey)?.label} per Game
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={playerTrendData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="game" tick={{ fill:C.textDim, fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:C.textDim, fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltipStyle} />
                <Line type="monotone" dataKey="value" stroke={C.redBright} strokeWidth={2.5} dot={{ fill:C.redBright, r:4 }} name={STAT_OPTIONS.find(o=>o.value===statKey)?.label} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Player comparison bar chart */}
        {comparisonData.length > 0 && (
          <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
            <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>
              Season Average -- {STAT_OPTIONS.find(o=>o.value===statKey)?.label} per Player
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={comparisonData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fill:C.textSub, fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:C.textDim, fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltipStyle} formatter={v=>[`${v}`,"Avg"]} />
                <Bar dataKey="value" fill={C.red} radius={[4,4,0,0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const { players, games } = await getAllPublicData();
  return { props: { players, games } };
}
