import { useState } from "react";
import Layout from "../components/Layout";
import { SectionHeading } from "../components/ui";
import { C } from "../lib/theme";
import { getAllPublicData, getAllSeasonsStats } from "../lib/data";
import { buildAllTimeStatsMap } from "../lib/stats";
import { fmt } from "../lib/utils";
import SeasonSelector from "../components/SeasonSelector";
import ErrorBoundary from "../components/ErrorBoundary";

const MEDALS = [
  { color:C.gold,   label:"🥇", bg:`${C.gold}18`,   border:`${C.gold}45`   },
  { color:C.silver, label:"🥈", bg:`${C.silver}15`, border:`${C.silver}40` },
  { color:C.bronze, label:"🥉", bg:`${C.bronze}15`, border:`${C.bronze}40` },
];
const COLS = [
  { key:"mpg",   label:"MPG", title:"Minutes Per Game",        dec:1 },
  { key:"ppg",   label:"PPG", title:"Points Per Game",         dec:1 },
  { key:"ftPct", label:"FT%", title:"Free Throw %",            dec:1, pct:true },
  { key:"fgPct", label:"FG%", title:"Field Goal %",            dec:1, pct:true },
  { key:"fg2Pct",label:"2P%", title:"2-Point %",               dec:1, pct:true },
  { key:"fg3Pct",label:"3P%", title:"3-Point %",               dec:1, pct:true },
  { key:"apg",   label:"APG", title:"Assists Per Game",        dec:1 },
  { key:"rpg",   label:"RPG", title:"Rebounds Per Game",       dec:1 },
  { key:"orpg",  label:"ORB", title:"Off. Rebounds Per Game",  dec:1 },
  { key:"drpg",  label:"DRB", title:"Def. Rebounds Per Game",  dec:1 },
  { key:"spg",   label:"SPG", title:"Steals Per Game",         dec:1 },
  { key:"bpg",   label:"BPG", title:"Blocks Per Game",         dec:1 },
  { key:"tpg",   label:"TPG", title:"Turnovers Per Game",      dec:1 },
  { key:"fpg",   label:"FPG", title:"Fouls Per Game",          dec:1 },
  { key:"eff",   label:"EFF", title:"Efficiency Rating",       dec:1 },
];

export default function LeaderboardPage({ players, statsMap, seasons, currentSeason, allTimeStatsMap }) {
  const [sortKey, setSortKey] = useState("ppg");
  const [sortDir, setSortDir] = useState("desc");
  const [activeSeason, setActiveSeason] = useState(currentSeason);

  // Pick stats source based on selected season
  const activeStats = activeSeason === "all-time" ? allTimeStatsMap : statsMap;

  const handleSort = key => {
    if (key === sortKey) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  // Merge bio + stats, filter to players who have played
  const playersWithStats = players
    .map(p => ({ ...p, stats: activeStats[p.id] ?? {} }))
    .filter(p => (p.stats.gp ?? 0) > 0 || activeSeason === "all-time");

  const sorted = [...playersWithStats].sort((a, b) => {
    const av = a.stats[sortKey] ?? 0, bv = b.stats[sortKey] ?? 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  return (
    <Layout title="Leaderboard">
      <SectionHeading label="2025–26 Season" title="Leaderboard" />

      <SeasonSelector
        seasons={seasons}
        currentSeason={activeSeason}
        onChange={setActiveSeason}
        showAllTime={true}
        right="Click column to sort"
      />

      <div style={{ fontSize:12, color:C.textDim, marginBottom:16 }}>
        Sorted by: <span style={{ color:C.redText, fontWeight:900 }}>{COLS.find(c=>c.key===sortKey)?.title}</span>
        <span style={{ color:C.textDim }}> {sortDir==="desc"?"↓":"↑"}</span>
      </div>

      <ErrorBoundary label="Leaderboard table failed to load">
      <div style={{ borderRadius:12, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:C.base, borderBottom:`1px solid ${C.border2}` }}>
                <th style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:900, letterSpacing:"0.12em", color:C.textDim, width:32 }}>#</th>
                <th style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:900, letterSpacing:"0.12em", color:C.textDim, minWidth:160 }}>PLAYER</th>
                <th style={{ padding:"10px 8px", fontSize:10, fontWeight:900, letterSpacing:"0.12em", color:C.textDim, minWidth:48 }}>POS</th>
                {COLS.map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)} title={col.title} style={{
                    padding:"10px 8px", minWidth:52, cursor:"pointer", userSelect:"none",
                  }}>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                      <span style={{ fontSize:10, fontWeight:900, letterSpacing:"0.1em", color: sortKey===col.key ? C.redText : C.textDim }}>
                        {col.label} {sortKey===col.key ? (sortDir==="desc"?"↓":"↑") : ""}
                      </span>
                      {sortKey===col.key && <div style={{ height:2, width:16, borderRadius:1, background:C.redBright }} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, idx) => {
                const medal = idx < 3 ? MEDALS[idx] : null;
                return (
                  <tr key={p.id} style={{ background: medal ? medal.bg : idx%2===0 ? C.surface : C.surface2, borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:"10px 14px", textAlign:"center" }}>
                      {medal ? <span style={{ fontSize:16 }}>{medal.label}</span>
                              : <span style={{ fontSize:11, fontWeight:900, color:C.textDim }}>{idx+1}</span>}
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{
                          width:26, height:26, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:10, fontWeight:900, flexShrink:0,
                          background: medal ? `${medal.color}30` : C.border,
                          color: medal ? medal.color : C.textSub,
                          border: medal ? `1px solid ${medal.color}55` : "none",
                        }}>{p.number}</div>
                        <span style={{ fontWeight:900, color: medal ? medal.color : C.text }}>{fmt(p.name)}</span>
                      </div>
                    </td>
                    <td style={{ padding:"10px 8px", textAlign:"center", fontSize:11, fontWeight:700, color:C.textDim }}>{p.position.split("/")[0]}</td>
                    {COLS.map(col => {
                      const val = p.stats[col.key];
                      const display = col.pct ? (val > 0 ? `${val.toFixed(col.dec)}%` : "—") : val?.toFixed(col.dec) ?? "—";
                      return (
                        <td key={col.key} style={{ padding:"10px 8px", textAlign:"center" }}>
                          <span style={{ fontWeight: col.key===sortKey ? 900 : 600, color: col.key===sortKey && idx===0 ? C.redText : col.key===sortKey ? C.text : C.textSub }}>
                            {display}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      </ErrorBoundary>
      <div style={{ display:"flex", gap:20, flexWrap:"wrap", marginTop:16 }}>
        {MEDALS.map((m,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span>{m.label}</span>
            <span style={{ fontSize:12, fontWeight:700, color:m.color }}>{["1st","2nd","3rd"][i]} place</span>
          </div>
        ))}
      </div>
    </Layout>
  );
}

export async function getStaticProps() {
  const { seasons, currentSeason, players, stats } = await getAllPublicData(null);
  const allSeasonsStats = await getAllSeasonsStats(seasons);
  const allTimeStatsMap = buildAllTimeStatsMap(allSeasonsStats, players);
  return { props: { players, statsMap: stats, seasons, currentSeason, allTimeStatsMap }, revalidate: 3600 };
}
