import { useState } from "react";
import Image from "next/image";
import Layout from "../components/Layout";
import { SectionHeading } from "../components/ui";
import { C } from "../lib/theme";
import { getAllPublicData, getAllSeasonsStats } from "../lib/data";
import { buildAllTimeStatsMap } from "../lib/stats";
import { fmt } from "../lib/utils";
import SeasonSelector from "../components/SeasonSelector";
import { PlayerDetail } from "../components/PlayerDetail";

const playerImg = (player: any) => player.photoUrl || null;

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
          ? <Image src={playerImg(player)} alt={player.name} fill style={{ objectFit:"cover", objectPosition:"top" }} />
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

  const sorted = [...playersWithStats].sort((a, b) => Number(a.number) - Number(b.number));
  const displayed = search.trim()
    ? sorted.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : sorted;

  return (
    <Layout title="Players">
      <SectionHeading label="2025-26 Season" title="Players" />
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
          placeholder="Search players..."
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

  return { props: { players, statsMap: stats, seasons, currentSeason, allTimeStatsMap, playerSeasonHistory }, revalidate: 86400 };
}
