import React from "react";

interface Props {
  teamAvg: { fgPct: number; fg3Pct: number; ftPct: number };
}

export function ShootingSplits({ teamAvg }: Props) {
  return (
    <div className="rounded-xl p-5 border border-ak-border bg-ak-surface">
      <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-4 uppercase">Shooting Splits</div>
      {([
        ["Field Goals", teamAvg.fgPct],
        ["3-Pointers",  teamAvg.fg3Pct],
        ["Free Throws", teamAvg.ftPct],
      ] as [string, number][]).map(([label, val]) => (
        <div key={label} className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-xs font-bold text-ak-text-sub">{label}</span>
            <span className="text-[13px] font-black text-ak-text">{val}%</span>
          </div>
          <div className="h-1 rounded-sm bg-ak-border">
            <div
              className="h-full rounded-sm bg-ak-red-bright transition-[width] duration-[400ms] w-[var(--pb)]"
              style={{ "--pb": `${Math.min(100, val)}%` } as React.CSSProperties}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
