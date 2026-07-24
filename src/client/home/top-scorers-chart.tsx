import { C } from "@/theme/tokens";
import { ShowMoreButton } from "./show-more-button";

export function TopScorersChart({ topScorers }: { topScorers: { name: string; ppg: number }[] }) {
  if (topScorers.length === 0) return null;
  const max = Math.max(...topScorers.map(p => p.ppg), 1);
  return (
    <div className="rounded-2xl p-5 border border-ak-border bg-ak-surface shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase">Top Scorers - PPG</div>
        <ShowMoreButton href="/players" className="show-more-btn">All Players →</ShowMoreButton>
      </div>
      <div className="flex flex-col gap-2.5">
        {topScorers.map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 sm:w-[130px] shrink-0 truncate text-right text-xs font-bold text-ak-text-sub">{p.name}</div>
            <div className="flex-1">
              <div
                className="h-6 rounded-r"
                style={{
                  width: `${Math.max(2, (p.ppg / max) * 100)}%`,
                  background: i === 0 ? C.redBright : `linear-gradient(90deg, ${C.red}, ${C.redBright})`,
                }}
              />
            </div>
            <div className="w-9 shrink-0 text-[11px] font-bold text-ak-text-dim tabular-nums">{p.ppg}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
