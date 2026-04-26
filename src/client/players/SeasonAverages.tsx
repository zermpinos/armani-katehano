import { fmtMinutes } from "@/domain/shared/format";
import { StatCell } from "./StatCell";

export function SeasonAverages({ s }: any) {
  return (
    <>
      <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-3 uppercase">
        Season Averages
      </div>
      <div className="grid grid-cols-4 gap-2 mb-6">
        <StatCell label="PPG" value={s.ppg} highlight />
        <StatCell label="RPG" value={s.rpg} />
        <StatCell label="ORB" value={s.orpg ?? 0} />
        <StatCell label="DRB" value={s.drpg ?? 0} />
        <StatCell label="APG" value={s.apg} />
        <StatCell label="SPG" value={s.spg} />
        <StatCell label="BPG" value={s.bpg} />
        <StatCell label="TPG" value={s.tpg} />
        <StatCell label="FPG" value={s.fpg ?? 0} />
        <StatCell label="FG%"  value={s.fgPct > 0 ? `${s.fgPct}%` : "—"} />
        <StatCell label="2P%"  value={s.fg2Pct > 0 ? `${s.fg2Pct}%` : "—"} />
        <StatCell label="3P%"  value={s.fg3Pct > 0 ? `${s.fg3Pct}%` : "—"} />
        <StatCell label="FT"   value={s.ftaPg > 0 ? `${s.ftmPg}/${s.ftaPg}` : "—"} />
        <StatCell label="FT%"  value={s.ftPct > 0 ? `${s.ftPct}%` : "—"} />
        <StatCell label="MPG"  value={s.mpg > 0 ? fmtMinutes(s.mpg) : "—"} />
        <StatCell label="EFF"  value={s.eff} highlight />
      </div>
    </>
  );
}
