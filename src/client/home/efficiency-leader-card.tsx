import { fmt } from "@/domain/players/format";
import { fmtMinutes } from "@/domain/shared/format";
import { ShowMoreButton } from "./show-more-button";
import Link from "next/link";

export function EfficiencyLeaderCard({ mvp }: { mvp: any }) {
  if (!mvp || mvp.stats.eff <= 0) return null;
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden border border-[#c0392b35] bg-ak-surface shadow-[0_1px_1px_rgba(0,0,0,0.25)]">
      <div className="absolute top-0 right-0 w-[140px] h-[140px] rounded-full bg-[#8b1a1a12] translate-x-[40%] -translate-y-[40%]" />
      <div className="mb-[14px] relative z-[1] flex items-start justify-between">
        <div className="text-[11px] font-black tracking-[0.15em] text-ak-red-text uppercase">⚡ Efficiency Leader</div>
        <ShowMoreButton href="/players" className="show-more-btn">All Players →</ShowMoreButton>
      </div>
      <Link
        href={`/players/${mvp.slug}`}
        data-testid="efficiency-leader-link"
        className="rounded-xl py-[14px] px-4 mb-3 border border-[#e0555525] bg-[#8b1a1a08] flex items-center justify-between gap-3 relative z-[1] hover:opacity-90 transition-opacity no-underline"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-[#8b1a1a20] border border-[#e0555530] shrink-0 text-base">
            🏀
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-ak-text">{fmt(mvp.name)}</div>
            <div className="text-[11px] font-bold text-ak-text-dim mt-0.5">#{mvp.number} · {mvp.position}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[22px] font-black text-ak-red-text">{mvp.stats.eff}</div>
          <div className="text-[10px] font-bold text-ak-text-dim tracking-[0.1em]">EFF</div>
        </div>
      </Link>
      <div className="grid grid-cols-3 gap-2 relative z-[1]">
        {[
          ["PPG", mvp.stats.ppg],
          ["RPG", mvp.stats.rpg],
          ["APG", mvp.stats.apg],
          ["FG%", `${mvp.stats.fgPct}%`],
          ["GP",  mvp.stats.gp],
          ["MPG", mvp.stats.mpg > 0 ? fmtMinutes(mvp.stats.mpg) : "—"],
        ].map(([l, v]) => (
          <div key={l} className="text-center rounded-lg py-2 px-1 bg-ak-base border border-ak-border">
            <div className="text-[10px] font-black tracking-[0.12em] text-ak-text-dim">{l}</div>
            <div className="text-[13px] font-black text-ak-text mt-0.5">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
