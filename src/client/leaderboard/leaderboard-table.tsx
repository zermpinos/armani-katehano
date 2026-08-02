import { useState } from "react";
import { fmt } from "@/domain/players/format";
import { fmtMinutes } from "@/domain/shared/format";
import { TooltipHint, TS_PCT_EXPLANATION } from "@/components/ui";
import Link from "next/link";

const MEDALS = [
  { label: "🥇", textCls: "text-ak-gold",   rowBgCls: "bg-[#c9a84c18]", stickyBgCls: "bg-[#2c2922]", borderCls: "border-[#c9a84c45]", numBgCls: "bg-[#c9a84c30]", numBorderCls: "border-[#c9a84c55]" },
  { label: "🥈", textCls: "text-ak-silver", rowBgCls: "bg-[#9ba3af15]", stickyBgCls: "bg-[#26272a]", borderCls: "border-[#9ba3af40]", numBgCls: "bg-[#9ba3af30]", numBorderCls: "border-[#9ba3af55]" },
  { label: "🥉", textCls: "text-ak-bronze", rowBgCls: "bg-[#b8733315]", stickyBgCls: "bg-[#292320]", borderCls: "border-[#b8733340]", numBgCls: "bg-[#b8733330]", numBorderCls: "border-[#b8733355]" },
];

export const COLS = [
  { key: "gp",     label: "GP",  title: "Games Played",           dec: 0, default: true },
  { key: "ppg",    label: "PPG", title: "Points Per Game",        dec: 1, default: true },
  { key: "rpg",    label: "RPG", title: "Rebounds Per Game",      dec: 1, default: true },
  { key: "apg",    label: "APG", title: "Assists Per Game",       dec: 1, default: true },
  { key: "eff",    label: "EFF", title: "Efficiency Rating",      dec: 1, default: true },
  { key: "fgPct",  label: "FG%", title: "Field Goal %",           dec: 1, pct: true, denom: "fga", default: true },
  { key: "tsPct",  label: "TS%", title: "True Shooting %",        dec: 1, pct: true, default: true, tooltip: true },
  { key: "ftPct",  label: "FT%", title: "Free Throw %",           dec: 1, pct: true, denom: "fta", default: true },

  { key: "mpg",    label: "MPG", title: "Minutes Per Game",       dec: 1, min: true, group: "PLAYING TIME" },
  { key: "fg2Pct", label: "2P%", title: "2-Point %",              dec: 1, pct: true, denom: "fg2a", group: "SHOOTING" },
  { key: "fg3Pct", label: "3P%", title: "3-Point %",              dec: 1, pct: true, denom: "fg3a", group: "SHOOTING" },
  { key: "orpg",   label: "ORB", title: "Off. Rebounds Per Game", dec: 1, group: "REBOUNDING" },
  { key: "drpg",   label: "DRB", title: "Def. Rebounds Per Game", dec: 1, group: "REBOUNDING" },
  { key: "spg",    label: "SPG", title: "Steals Per Game",        dec: 1, group: "DEFENSE" },
  { key: "bpg",    label: "BPG", title: "Blocks Per Game",        dec: 1, group: "DEFENSE" },
  { key: "tpg",    label: "TPG", title: "Turnovers Per Game",     dec: 1, group: "DISCIPLINE" },
  { key: "fpg",    label: "FPG", title: "Fouls Per Game",         dec: 1, group: "DISCIPLINE" },
];

export const TOTAL_COLS = [
  { key: "gp",        label: "GP",  title: "Games Played",         dec: 0, default: true },
  { key: "pts_total", label: "PTS", title: "Total Points",         dec: 0, default: true },
  { key: "reb_total", label: "REB", title: "Total Rebounds",       dec: 0, default: true },
  { key: "ast_total", label: "AST", title: "Total Assists",        dec: 0, default: true },
  { key: "fgPct",     label: "FG%", title: "Field Goal %",         dec: 1, pct: true, denom: "fga", default: true },
  { key: "tsPct",     label: "TS%", title: "True Shooting %",      dec: 1, pct: true, default: true, tooltip: true },
  { key: "ftPct",     label: "FT%", title: "Free Throw %",         dec: 1, pct: true, denom: "fta", default: true },

  { key: "stl_total", label: "STL", title: "Total Steals",         dec: 0, group: "OTHER" },
  { key: "pf_total",  label: "PF",  title: "Total Fouls",          dec: 0, group: "OTHER" },
  { key: "fgm",       label: "FGM", title: "Field Goals Made",     dec: 0, group: "SHOOTING" },
  { key: "fga",       label: "FGA", title: "Field Goals Attempted",dec: 0, group: "SHOOTING" },
  { key: "fg2Pct",    label: "2P%", title: "2-Point %",            dec: 1, pct: true, denom: "fg2a", group: "SHOOTING" },
  { key: "fg3m",      label: "3PM", title: "3-Pointers Made",      dec: 0, group: "SHOOTING" },
  { key: "fg3a",      label: "3PA", title: "3-Pointers Attempted", dec: 0, group: "SHOOTING" },
  { key: "fg3Pct",    label: "3P%", title: "3-Point %",            dec: 1, pct: true, denom: "fg3a", group: "SHOOTING" },
  { key: "ftm",       label: "FTM", title: "Free Throws Made",     dec: 0, group: "SHOOTING" },
  { key: "fta",       label: "FTA", title: "Free Throws Attempted",dec: 0, group: "SHOOTING" },
];

/**
 * Groups a column list into contiguous same-group spans for a header row,
 * e.g. [default,default,SHOOTING,SHOOTING,DEFENSE] -> [{null,2},{SHOOTING,2},{DEFENSE,1}].
 * Columns without a `group` (the always-visible defaults) collapse into a
 * single blank span rather than one cell each.
 */
export function buildGroupRow(cols: { group?: string }[]) {
  const cells: { label: string | null; span: number }[] = [];
  for (const col of cols) {
    const label = col.group ?? null;
    const last = cells[cells.length - 1];
    if (last && last.label === label) {
      last.span += 1;
    } else {
      cells.push({ label, span: 1 });
    }
  }
  return cells;
}

/**
 * Decides whether collapsing "more stats" needs to move the active sort off
 * a column that's about to disappear. Returns the key to switch to (the
 * first default column), or null if the current sortKey is already a
 * default column and nothing needs to change.
 */
export function nextSortKeyOnCollapse(sortKey: string, cols: { key: string; default?: boolean }[]): string | null {
  const defaultCols = cols.filter(c => c.default);
  if (defaultCols.some(c => c.key === sortKey)) return null;
  return defaultCols[0]?.key ?? null;
}

interface Props {
  sorted: any[];
  activeCols: any[];
  sortKey: string;
  sortDir: string;
  onSort: (key: string) => void;
}

export function LeaderboardTable({ sorted, activeCols, sortKey, sortDir, onSort }: Props) {
  const [showAll, setShowAll] = useState(false);
  const visibleCols = showAll ? activeCols : activeCols.filter((c: any) => c.default);
  const groupRow = showAll ? buildGroupRow(visibleCols) : [];

  const handleToggle = () => {
    if (showAll) {
      // Collapsing: if the table is sorted by a column that's about to be
      // hidden, fall back to a default column so the sort stays explicable.
      const resetKey = nextSortKeyOnCollapse(sortKey, activeCols);
      if (resetKey) onSort(resetKey);
    }
    setShowAll(v => !v);
  };

  return (
    <>
      <div className="flex justify-end mb-2">
        <button
          onClick={handleToggle}
          className={`px-[10px] py-[3px] text-[10px] font-black tracking-[0.1em] rounded-md cursor-pointer border transition-all duration-150 ${
            showAll
              ? "border-[#c0392b60] bg-[#8b1a1a25] text-ak-red-text"
              : "border-ak-border bg-transparent text-ak-text-dim"
          }`}
        >
          {showAll ? "− LESS STATS" : "+ MORE STATS"}
        </button>
      </div>

      <div className="rounded-xl border border-ak-border overflow-hidden">
        <div className="relative">
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              {showAll && (
                <tr className="bg-ak-base">
                  <th className="sticky left-0 z-20 bg-ak-base w-8 transform-gpu" />
                  <th className="sticky left-[48px] z-20 bg-ak-base min-w-[160px] transform-gpu" />
                  <th className="min-w-[48px]" />
                  {groupRow.map((g, i) => (
                    g.label
                      ? <th key={i} colSpan={g.span} className="px-2 pt-2 text-center text-[9px] font-black tracking-[0.15em] uppercase text-ak-text-dim/70">{g.label}</th>
                      : <th key={i} colSpan={g.span} />
                  ))}
                </tr>
              )}
              <tr className="bg-ak-base border-b border-ak-border2">
                <th className="sticky left-0 z-20 bg-ak-base px-[14px] py-[10px] text-left text-[10px] font-black tracking-[0.12em] text-ak-text-dim w-8 transform-gpu">#</th>
                <th className="sticky left-[48px] z-20 bg-ak-base px-[14px] py-[10px] text-left text-[10px] font-black tracking-[0.12em] text-ak-text-dim min-w-[160px] transform-gpu">PLAYER</th>
                <th className="px-2 py-[10px] text-[10px] font-black tracking-[0.12em] text-ak-text-dim min-w-[48px]">POS</th>
                {visibleCols.map((col: any) => {
                  const labelText = (
                    <span className={`text-[10px] font-black tracking-[0.1em] ${col.tooltip ? "underline decoration-dotted cursor-help" : ""} ${sortKey === col.key ? "text-ak-red-text" : "text-ak-text-dim"}`}>
                      {col.label} {sortKey === col.key ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </span>
                  );
                  return (
                    <th
                      key={col.key}
                      onClick={() => onSort(col.key)}
                      title={col.tooltip ? undefined : col.title}
                      className="px-2 py-[10px] min-w-[52px] cursor-pointer select-none"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        {col.tooltip
                          ? <TooltipHint text={TS_PCT_EXPLANATION} placement="bottom">{labelText}</TooltipHint>
                          : labelText}
                        {sortKey === col.key && <div className="h-0.5 w-4 rounded-full bg-ak-red-bright" />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, idx) => {
                const medal = idx < 3 ? Reflect.get(MEDALS, idx) as (typeof MEDALS)[0] : null;
                const rowBgCls = medal ? medal.rowBgCls : idx % 2 === 0 ? "bg-ak-surface" : "bg-ak-surface2";
                // rowBgCls is a translucent tint on medal rows; sticky cells need an opaque one.
                const stickyBgCls = medal ? medal.stickyBgCls : rowBgCls;
                return (
                  <tr
                    key={p.id}
                    className={`relative border-b border-ak-border transition-colors duration-100 hover:bg-[#c0392b12] ${rowBgCls}`}
                  >
                    <td className={`sticky left-0 z-10 w-8 px-[14px] py-[10px] text-center transform-gpu ${stickyBgCls}`}>
                      {medal
                        ? <span className="text-base">{medal.label}</span>
                        : <span className="text-[11px] font-black text-ak-text-dim">{idx + 1}</span>}
                    </td>
                    <td className={`sticky left-[48px] z-10 px-[14px] py-[10px] transform-gpu ${stickyBgCls}`}>
                      <div className="flex items-center gap-[10px]">
                        <div className={`w-[26px] h-[26px] rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                          medal
                            ? `${medal.numBgCls} ${medal.textCls} border ${medal.numBorderCls}`
                            : "bg-ak-border text-ak-text-sub"
                        }`}>{p.number}</div>
                        <Link
                          href={`/players/${p.slug}`}
                          className={`font-black after:absolute after:inset-0 after:content-[''] ${medal ? medal.textCls : "text-ak-text"}`}
                        >
                          {fmt(p.name)}
                        </Link>
                      </div>
                    </td>
                    <td className="px-2 py-[10px] text-center text-[11px] font-bold text-ak-text-dim">{p.position.split("/")[0]}</td>
                    {visibleCols.map((col: any) => {
                      const val = p.stats[col.key];
                      const display = col.pct
                        ? (col.denom ? p.stats[col.denom] > 0 : val > 0) ? `${val.toFixed(col.dec)}%` : "-"
                        : col.min
                          ? (val > 0 ? fmtMinutes(val) : "-")
                          : col.dec === 0
                            ? (val != null ? String(val) : "-")
                            : val?.toFixed(col.dec) ?? "-";
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
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-[#242426] sm:hidden" />
        </div>
      </div>
      <div className="sm:hidden text-[10px] text-ak-text-dim text-center mt-2 tracking-[0.1em]">← scroll for more →</div>

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
