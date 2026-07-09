import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Layout from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui";
import { getAllPublicData, getAllSeasonsStats } from "@/server/db/repositories";
import { buildAllTimeStatsMap } from "@/domain/stats";
import { fmt } from "@/domain/players/format";
import SeasonSelector from "@/components/ui/SeasonSelector";
import ArchivedBanner from "@/components/ui/ArchivedBanner";

const playerImg = (player: any) => player.photoUrl || null;

function PlayerCard({ player }: any) {
  const s = player.stats;
  const hasStats = s.gp > 0;
  return (
    <Link
      href={`/players/${player.slug}`}
      className={`group rounded-xl overflow-hidden text-left w-full cursor-pointer border border-ak-border bg-ak-surface transition-all duration-200 hover:border-[#c0392b55] hover:shadow-[0_8px_32px_#8b1a1a30] ${hasStats ? "opacity-100" : "opacity-55"}`}
    >
      <div className="h-[170px] flex items-end justify-center bg-ak-base relative">
        {playerImg(player)
          ? <Image src={playerImg(player)} alt={player.name} fill className="object-cover object-top" />
          : <span className="text-[52px] leading-none pb-3 z-[1] relative">🏀</span>
        }
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
    </Link>
  );
}

export default function PlayersPage({ players, statsMap, statsBySeason, seasons, currentSeason, allTimeStatsMap, playerSeasonHistory, archivedSeasonNames }: any) {
  const [activeSeason, setActiveSeason] = useState(currentSeason);
  const [search, setSearch] = useState("");

  const activeStatsMap = activeSeason === "all-time" ? allTimeStatsMap : (Reflect.get((statsBySeason ?? {}) as object, activeSeason) ?? statsMap);
  const playersWithStats = players.map((p: any) => ({
    ...p,
    stats:         activeStatsMap[p.id] ?? { ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,ftmPg:0,ftaPg:0,mpg:0,eff:0,gp:0 },
    seasonHistory: playerSeasonHistory?.[p.id] ?? {},
  }));

  const sorted    = [...playersWithStats].sort((a, b) => Number(a.number) - Number(b.number));
  const displayed = search.trim()
    ? sorted.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : sorted;

  return (
    <Layout title="Players">
      <SectionHeading label={activeSeason === "all-time" ? "All Time" : activeSeason} title="Players" />
      <SeasonSelector
        seasons={seasons}
        currentSeason={activeSeason}
        onChange={sid => { setActiveSeason(sid); setSearch(""); }}
        showAllTime={true}
        right={`${players.length} Players`}
      />
      <ArchivedBanner archived={archivedSeasonNames.includes(activeSeason)} seasonName={activeSeason} />
      <div className="mb-4">
        <label className="relative inline-flex items-center w-full max-w-[260px]">
          <svg className="absolute left-3 text-ak-text-dim pointer-events-none shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full py-[7px] pl-[30px] pr-[14px] rounded-lg border border-ak-border2 bg-ak-surface2 text-ak-text text-xs outline-none"
          />
        </label>
      </div>
      {search.trim() && displayed.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-[40px] mb-3">🏀</div>
          <div className="text-[15px] font-bold text-ak-text">No players match &ldquo;{search}&rdquo;</div>
          <button
            onClick={() => setSearch("")}
            className="mt-3 text-[12px] text-ak-red-text underline cursor-pointer bg-transparent border-0"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(185px,1fr))] gap-[14px]">
          {displayed.map(p => <PlayerCard key={p.id} player={p} />)}
        </div>
      )}
    </Layout>
  );
}

export async function getStaticProps() {
  try {
    const { seasons, currentSeason, players, stats, archivedSeasonNames } = await getAllPublicData(null);
    const allSeasonsStats = await getAllSeasonsStats(seasons);
    const allTimeStatsMap = buildAllTimeStatsMap(allSeasonsStats, players);

    const playerSeasonHistory: Record<string, any> = {};
    for (const [sid, seasonMap] of Object.entries(allSeasonsStats)) {
      for (const player of players) {
        const s = (seasonMap as any)[player.id];
        if (s && s.gp > 0) {
          if (!Reflect.has(playerSeasonHistory, player.id)) Reflect.set(playerSeasonHistory, player.id, {});
          Reflect.set(Reflect.get(playerSeasonHistory as object, player.id), sid, s);
        }
      }
    }

    return { props: { players, statsMap: stats, statsBySeason: allSeasonsStats, seasons, currentSeason, allTimeStatsMap, playerSeasonHistory, archivedSeasonNames }, revalidate: 3600 };
  } catch {
    // DB unavailable at build time (e.g. CI); ISR revalidates on first request.
    return { props: { players: [], statsMap: {}, seasons: [], currentSeason: "", allTimeStatsMap: {}, playerSeasonHistory: {}, archivedSeasonNames: [] }, revalidate: 60 };
  }
}
