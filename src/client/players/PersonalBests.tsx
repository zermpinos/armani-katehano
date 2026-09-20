import Link from "next/link";
import { fmtDate } from "@/domain/shared/format";
import type { GameHigh } from "@/domain/stats/records";

export function PersonalBests({ highs, title }: { highs: GameHigh[]; title: string }) {
  if (!highs.length) return null;

  return (
    <>
      <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-3 uppercase">
        {title}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {highs.map(h => (
          <Link
            key={h.key}
            href={`/games/${h.gameId}`}
            aria-label={`${h.value} ${h.label} against ${h.opponent} on ${fmtDate(h.date)}, open the box score`}
            className="flex flex-col items-center justify-center rounded-[10px] py-[10px] px-1 border border-ak-border bg-ak-surface2 no-underline transition-colors duration-150 hover:border-ak-border2"
          >
            <div className="text-[10px] font-black tracking-[0.12em] text-ak-text-dim">{h.label}</div>
            <div className="text-[16px] font-black mt-0.5 text-ak-text">{h.value}</div>
            <div className="text-[10px] text-ak-text-sub mt-1 max-w-full truncate">{h.opponent}</div>
            <div className="text-[10px] text-ak-text-dim">{fmtDate(h.date)}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
