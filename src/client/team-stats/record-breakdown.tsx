interface Props {
  rec: {
    wins: number; losses: number;
    homeWins: number; homeLosses: number;
    awayWins: number; awayLosses: number;
    streak: { count: number; type: string };
  };
}

export function RecordBreakdown({ rec }: Props) {
  return (
    <div className="rounded-xl p-5 border border-ak-border bg-ak-surface">
      <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-4 uppercase">Record Breakdown</div>
      {([
        ["Overall", rec.wins,     rec.losses],
        ["Home",    rec.homeWins, rec.homeLosses],
        ["Away",    rec.awayWins, rec.awayLosses],
      ] as [string, number, number][]).map(([label, w, l]) => (
        <div key={label} className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-bold text-ak-text-sub">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-ak-text">{w}-{l}</span>
            <span className="text-[11px] text-ak-text-dim">{w+l > 0 ? `${(w/(w+l)*100).toFixed(0)}%` : "--"}</span>
          </div>
        </div>
      ))}
      <div className="mt-4 pt-3 border-t border-ak-border">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-ak-text-sub">Current Streak</span>
          <span className={`text-sm font-black ${rec.streak.count === 0 ? "text-ak-text-dim" : rec.streak.type === "W" ? "text-ak-green" : "text-ak-red-text"}`}>
            {rec.streak.count === 0 ? "--" : `${rec.streak.count}${rec.streak.type}`}
          </span>
        </div>
      </div>
    </div>
  );
}
