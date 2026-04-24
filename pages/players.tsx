import { useState } from "react";
import Image from "next/image";
import Layout from "../components/Layout";
import { SectionHeading } from "../components/ui";
import { getAllPublicData, getAllSeasonsStats } from "@/server/db/repositories";
import { buildAllTimeStatsMap } from "@/domain/stats";
import { fmt } from "@/domain/players/format";
import SeasonSelector from "../components/SeasonSelector";
import { PlayerDetail } from "../components/PlayerDetail";

const playerImg = (player: any) => player.photoUrl || null;

function PlayerCard({ player, onClick }: any) {
  const s = player.stats;
  const hasStats = s.gp > 0;
  return (
    <button
      onClick={onClick}
      className={`group rounded-xl overflow-hidden text-left w-full cursor-pointer border border-ak-border bg-ak-surface transition-all duration-200 hover:border-[#c0392b55] hover:shadow-[0_8px_32px_#8b1a1a30] ${hasStats ? "opacity-100" : "opacity-55"}`}
    >
      <div className="h-[170px] flex items-end justify-center bg-ak-base relative">
        {playerImg(player)
          ? <Image src={playerImg(player)} alt={player.name} fill className="object-cover object-top" />
          : <span className="text-[52px] leading-none pb-3 z-[1] relative">🏀</span>
        }
        {/* gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-[rgba(28,28,30,0.9)] z-[1] pointer-events-none" />
        <div className="absolute top-[10px] right-[10px] w-[26px] h-[26px] rounded-md flex items-center justify-center text-[11px] font-black bg-ak-red text-ak-text z-[2]">{player.number}</div>
        {hasStats && (
          <div className="absolute bottom-2 left-[10px] text-[10px] font-black tracking-[0.1em] text-ak-text-sub bg-[rgba(28,28,30,0.7)] rounded-md px-[7px] py-0.5 z-[2]">{s.gp} GP</div>
        )}
      </div>
      <div className="p-[14px]">
        <div className="text-[13px] font-black overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-200 text-ak-text group-hover:text-ak-red-text">{fmt(player.name)}</div>
        <div className="mt-1.5">
          <span className="text-[10px] font-black tracking-[0.12em] rounded-full px-2 py-0.5 text-ak-text-sub bg-ak-surface2 border border-ak-border2">{player.position}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-ak-border">
          {hasStats ? (
            <div className="flex">
              {[["PPG",s.ppg],["RPG",s.rpg],["APG",s.apg],["EFF",s.eff]].map(([l,v]) => (
                <div key={l} className="flex-1 text-center">
                  <div className="text-[10px] font-black tracking-[0.12em] text-ak-text-dim">{l}</div>
                  <div className={`text-sm font-black mt-0.5 ${l === "EFF" ? "text-ak-gold" : "text-ak-text"}`}>{v}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-[10px] font-bold tracking-[0.1em] text-ak-text-dim py-1">NO STATS YET</div>
          )}
        </div>
      </div>
      <div className="h-0.5 bg-ak-red-bright transition-transform duration-300 origin-left scale-x-0 group-hover:scale-x-100" />
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
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-[260px] py-[7px] px-[14px] rounded-lg border border-ak-border2 bg-ak-surface2 text-ak-text text-xs outline-none"
        />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(185px,1fr))] gap-[14px]">
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
