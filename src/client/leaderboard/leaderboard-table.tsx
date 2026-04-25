import { fmt } from "@/domain/players/format";
import { fmtMinutes } from "@/domain/shared/format";

export const MEDALS = [
  { label: "🥇", textCls: "text-ak-gold",   rowBgCls: "bg-[#c9a84c18]", borderCls: "border-[#c9a84c45]", numBgCls: "bg-[#c9a84c30]", numBorderCls: "border-[#c9a84c55]" },
  { label: "🥈", textCls: "text-ak-silver", rowBgCls: "bg-[#9ba3af15]", borderCls: "border-[#9ba3af40]", numBgCls: "bg-[#9ba3af30]", numBorderCls: "border-[#9ba3af55]" },
  { label: "🥉", textCls: "text-ak-bronze", rowBgCls: "bg-[#b8733315]", borderCls: "border-[#b8733340]", numBgCls: "bg-[#b8733330]", numBorderCls: "border-[#b8733355]" },
];

export const COLS = [
  { key: "mpg",    label: "MPG", title: "Minutes Per Game",       dec: 1, min: true },
  { key: "ppg",    label: "PPG", title: "Points Per Game",        dec: 1 },
  { key: "ftPct",  label: "FT%", title: "Free Throw %",           dec: 1, pct: true, denom: "fta" },
  { key: "fgPct",  label: "FG%", title: "Field Goal %",           dec: 1, pct: true, denom: "fga" },
  { key: "fg2Pct", label: "2P%", title: "2-Point %",              dec: 1, pct: true, denom: "fg2a" },
  { key: "fg3Pct", label: "3P%", title: "3-Point %",              dec: 1, pct: true, denom: "fg3a" },
  { key: "apg",    label: "APG", title: "Assists Per Game",       dec: 1 },
  { key: "rpg",    label: "RPG", title: "Rebounds Per Game",      dec: 1 },
  { key: "orpg",   label: "ORB", title: "Off. Rebounds Per Game", dec: 1 },
  { key: "drpg",   label: "DRB", title: "Def. Rebounds Per Game", dec: 1 },
  { key: "spg",    label: "SPG", title: "Steals Per Game",        dec: 1 },
  { key: "bpg",    label: "BPG", title: "Blocks Per Game",        dec: 1 },
  { key: "tpg",    label: "TPG", title: "Turnovers Per Game",     dec: 1 },
  { key: "fpg",    label: "FPG", title: "Fouls Per Game",         dec: 1 },
  { key: "eff",    label: "EFF", title: "Efficiency Rating",      dec: 1 },
];

export const TOTAL_COLS = [
  { key: "gp",        label: "GP",  title: "Games Played",         dec: 0 },
  { key: "pts_total", label: "PTS", title: "Total Points",         dec: 0 },
  { key: "reb_total", label: "REB", title: "Total Rebounds",       dec: 0 },
  { key: "ast_total", label: "AST", title: "Total Assists",        dec: 0 },
  { key: "stl_total", label: "STL", title: "Total Steals",         dec: 0 },
  { key: "fgm",       label: "FGM", title: "Field Goals Made",     dec: 0 },
  { key: "fga",       label: "FGA", title: "Field Goals Attempted",dec: 0 },
  { key: "fgPct",     label: "FG%", title: "Field Goal %",         dec: 1, pct: true, denom: "fga" },
  { key: "fg3m",      label: "3PM", title: "3-Pointers Made",      dec: 0 },
  { key: "fg3a",      label: "3PA", title: "3-Pointers Attempted", dec: 0 },
  { key: "fg3Pct",    label: "3P%", title: "3-Point %",            dec: 1, pct: true, denom: "fg3a" },
  { key: "ftm",       label: "FTM", title: "Free Throws Made",     dec: 0 },
  { key: "fta",       label: "FTA", title: "Free Throws Attempted",dec: 0 },
  { key: "ftPct",     label: "FT%", title: "Free Throw %",         dec: 1, pct: true, denom: "fta" },
  { key: "fg2Pct",    label: "2P%", title: "2-Point %",            dec: 1, pct: true, denom: "fg2a" },
];

interface Props {
  sorted: any[];
  activeCols: any[];
  sortKey: string;
  sortDir: string;
  onSort: (key: string) => void;
  onSelect: (player: any) => void;
}

export function LeaderboardTable({ sorted, activeCols, sortKey, sortDir, onSort, onSelect }: Props) {
  return (
    <>
      <div className="rounded-xl border border-ak-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-ak-base border-b border-ak-border2">
                <th className="px-[14px] py-[10px] text-left text-[10px] font-black tracking-[0.12em] text-ak-text-dim w-8">#</th>
                <th className="px-[14px] py-[10px] text-left text-[10px] font-black tracking-[0.12em] text-ak-text-dim min-w-[160px]">PLAYER</th>
                <th className="px-2 py-[10px] text-[10px] font-black tracking-[0.12em] text-ak-text-dim min-w-[48px]">POS</th>
                {activeCols.map(col => (
                  <th
                    key={col.key}
                    onClick={() => onSort(col.key)}
                    title={col.title}
                    className="px-2 py-[10px] min-w-[52px] cursor-pointer select-none"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-[10px] font-black tracking-[0.1em] ${sortKey === col.key ? "text-ak-red-text" : "text-ak-text-dim"}`}>
                        {col.label} {sortKey === col.key ? (sortDir === "desc" ? "↓" : "↑") : ""}
                      </span>
                      {sortKey === col.key && <div className="h-0.5 w-4 rounded-full bg-ak-red-bright" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, idx) => {
                const medal = idx < 3 ? Reflect.get(MEDALS, idx) as (typeof MEDALS)[0] : null;
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelect(p)}
                    className={`border-b border-ak-border cursor-pointer ${medal ? medal.rowBgCls : idx % 2 === 0 ? "bg-ak-surface" : "bg-ak-surface2"}`}
                  >
                    <td className="px-[14px] py-[10px] text-center">
                      {medal
                        ? <span className="text-base">{medal.label}</span>
                        : <span className="text-[11px] font-black text-ak-text-dim">{idx + 1}</span>}
                    </td>
                    <td className="px-[14px] py-[10px]">
                      <div className="flex items-center gap-[10px]">
                        <div className={`w-[26px] h-[26px] rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                          medal
                            ? `${medal.numBgCls} ${medal.textCls} border ${medal.numBorderCls}`
                            : "bg-ak-border text-ak-text-sub"
                        }`}>{p.number}</div>
                        <span className={`font-black ${medal ? medal.textCls : "text-ak-text"}`}>{fmt(p.name)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-[10px] text-center text-[11px] font-bold text-ak-text-dim">{p.position.split("/")[0]}</td>
                    {activeCols.map(col => {
                      const val = p.stats[col.key];
                      const display = col.pct
                        ? (col.denom ? p.stats[col.denom] > 0 : val > 0) ? `${val.toFixed(col.dec)}%` : "--"
                        : col.min
                          ? (val > 0 ? fmtMinutes(val) : "--")
                          : col.dec === 0
                            ? (val != null ? String(val) : "--")
                            : val?.toFixed(col.dec) ?? "--";
                      return (
                        <td key={col.key} className="px-2 py-[10px] text-center">
                          <span className={`${col.key === sortKey ? "font-black" : "font-semibold"} ${col.key === sortKey && idx === 0 ? "text-ak-red-text" : col.key === sortKey ? "text-ak-text" : "text-ak-text-sub"}`}>
                            {display}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-5 flex-wrap mt-4">
        {MEDALS.map((m, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span>{m.label}</span>
            <span className={`text-xs font-bold ${m.textCls}`}>{Reflect.get(["1st", "2nd", "3rd"], i) as string} place</span>
          </div>
        ))}
      </div>
    </>
  );
}
