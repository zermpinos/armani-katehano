import { C } from "@/theme/tokens";
import { fmtMinutes } from "@/domain/shared/format";

const MAX_MPG = 40;

export function MinutesChart({ minutesDist }: { minutesDist: { name: string; mpg: number; highlight?: boolean }[] }) {
  if (minutesDist.length === 0) return null;
  return (
    <div className="rounded-xl p-5 border border-ak-border bg-ak-surface">
      <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-4 uppercase">Minutes Distribution (MPG)</div>
      <div className="flex flex-col gap-2">
        {minutesDist.map((entry, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 sm:w-[130px] shrink-0 truncate text-right text-xs font-bold text-ak-text-sub">{entry.name}</div>
            <div className="flex-1">
              <div
                className="h-7 rounded-r"
                style={{
                  width: `${Math.max(1, Math.min(100, (entry.mpg / MAX_MPG) * 100))}%`,
                  background: entry.highlight || i === 0 ? C.redBright : C.red,
                }}
              />
            </div>
            <div className="w-10 shrink-0 text-[11px] font-bold text-ak-text-dim tabular-nums">{fmtMinutes(entry.mpg)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
