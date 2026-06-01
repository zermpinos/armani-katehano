import { useState } from "react";
import Link from "next/link";
import { C, chartTooltipStyle } from "@/theme/tokens";
import { fmtMinutes } from "@/domain/shared/format";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const STAT_OPTIONS = [
  { key:"pts", label:"PTS", color:C.redBright, activeClass:"border-[#c0392b80] bg-[#c0392b20] text-[#c0392b]" },
  { key:"reb", label:"REB", color:C.textSub,   activeClass:"border-[#a8a8ac80] bg-[#a8a8ac20] text-[#a8a8ac]" },
  { key:"ast", label:"AST", color:"#5ba4cf",   activeClass:"border-[#5ba4cf80] bg-[#5ba4cf20] text-[#5ba4cf]" },
  { key:"stl", label:"STL", color:C.green,     activeClass:"border-[#4caf7d80] bg-[#4caf7d20] text-[#4caf7d]" },
  { key:"blk", label:"BLK", color:"#a29bfe",   activeClass:"border-[#a29bfe80] bg-[#a29bfe20] text-[#a29bfe]" },
  { key:"eff", label:"EFF", color:"#fdcb6e",   activeClass:"border-[#fdcb6e80] bg-[#fdcb6e20] text-[#fdcb6e]" },
];

export function GameLogPanel({ gameLog }: any) {
  const seasons = ["All", ...Array.from(new Set<string>(gameLog.map((g: any) => g.season).filter(Boolean) as string[])).sort().reverse()];
  const leagues = ["All", ...Array.from(new Set<string>(gameLog.map((g: any) => g.league).filter(Boolean) as string[])).sort()];

  const [selSeason, setSelSeason] = useState("All");
  const [selLeague, setSelLeague] = useState("All");
  const [selStat,   setSelStat]   = useState("pts");
  const [logView,   setLogView]   = useState("chart");

  const filtered = gameLog
    .filter((g: any) => (selSeason === "All" || g.season === selSeason) && (selLeague === "All" || g.league === selLeague))
    .map((g: any, i: number) => ({ ...g, label: `G${i + 1}` }));

  const activeStat = STAT_OPTIONS.find(o => o.key === selStat);

  const filterBtn = (active: boolean) => [
    "py-[3px] px-[10px] text-[10px] font-black tracking-[0.1em] rounded-md border cursor-pointer font-sans",
    active
      ? "border-[#c0392b60] bg-[#8b1a1a25] text-ak-red-text"
      : "border-ak-border bg-transparent text-ak-text-dim",
  ].join(" ");

  const viewBtn = (v: string) => [
    "py-[2px] px-[9px] text-[10px] font-black tracking-[0.08em] rounded-[5px] border cursor-pointer font-sans uppercase",
    logView === v
      ? "border-[#c0392b60] bg-[#8b1a1a25] text-ak-red-text"
      : "border-ak-border bg-transparent text-ak-text-dim",
  ].join(" ");

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1.5">
        <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase">
          Game Log {filtered.length > 0 ? `(${filtered.length})` : ""}
        </div>
        <div className="flex gap-1">
          {["chart","table"].map(v => (
            <button key={v} onClick={() => setLogView(v)} className={viewBtn(v)}>{v}</button>
          ))}
        </div>
      </div>

      {seasons.length > 2 && (
        <div className="flex gap-1 flex-wrap mb-1.5">
          {seasons.map(s => (
            <button key={s} className={filterBtn(selSeason === s)} onClick={() => setSelSeason(s)}>{s}</button>
          ))}
        </div>
      )}

      {leagues.length > 2 && (
        <div className="flex gap-1 flex-wrap mb-1.5">
          {leagues.map(l => (
            <button key={l} className={filterBtn(selLeague === l)} onClick={() => setSelLeague(l)}>
              {l === "rookie" ? "Rookie" : l === "bc6" ? "BC6" : l === "wintercup" ? "Winter Cup" : l}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1 flex-wrap mb-1.5">
        {STAT_OPTIONS.map(o => (
          <button
            key={o.key}
            onClick={() => setSelStat(o.key)}
            className={[
              "py-[3px] px-[10px] text-[10px] font-black tracking-[0.1em] rounded-md border cursor-pointer font-sans",
              selStat === o.key
                ? o.activeClass
                : "border-ak-border bg-transparent text-ak-text-dim",
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}
      </div>

      {logView === "chart" ? (
        <div className="rounded-xl border border-ak-border p-2 bg-ak-base">
          {filtered.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-ak-text-dim text-xs">
              No games match this filter
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={filtered} margin={{ top:8, right:4, left:-24, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="label" tick={{ fill:C.textDim, fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:C.textDim, fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  {...chartTooltipStyle}
                  formatter={(val) => [val, activeStat?.label]}
                  labelFormatter={(label, payload) => {
                    const g = payload?.[0]?.payload;
                    return g ? `${label} vs ${g.opponent}` : label;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={selStat}
                  stroke={activeStat?.color || C.redBright}
                  strokeWidth={2}
                  dot={{ fill: activeStat?.color || C.redBright, r:3 }}
                  name={activeStat?.label}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-ak-border bg-ak-base overflow-hidden">
          {filtered.length === 0 ? (
            <div className="h-20 flex items-center justify-center text-ak-text-dim text-xs">
              No games match this filter
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[260px]">
              <table className="w-full border-collapse text-[11px]">
                <thead className="sticky top-0 bg-ak-surface2 z-[1]">
                  <tr>
                    {["#","Date","vs","MIN","PTS","REB","AST","STL","BLK","FT","EFF"].map(h => (
                      <th
                        key={h}
                        className={[
                          "py-[5px] px-[7px] font-black tracking-[0.08em] text-ak-text-dim border-b border-ak-border whitespace-nowrap",
                          h === "vs" || h === "Date" ? "text-left" : "text-center",
                        ].join(" ")}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g: any, i: number) => (
                    <tr
                      key={g.gameId || i}
                      className={[
                        "border-b border-ak-border",
                        i % 2 === 0 ? "bg-ak-base" : "bg-transparent",
                      ].join(" ")}
                    >
                      <td className="py-[5px] px-[7px] text-center text-ak-text-dim font-bold">{i+1}</td>
                      <td className="py-[5px] px-[7px] text-ak-text-dim whitespace-nowrap">{g.date ? g.date.slice(5) : "-"}</td>
                      <td className="py-[5px] px-[7px] text-ak-text-sub">
                        <span className="block max-w-[90px] truncate">
                          <Link href={`/games/${g.gameId}`} className="hover:text-ak-red-text transition-colors duration-150">{g.opponent || "-"}</Link>
                        </span>
                      </td>
                      <td className="py-[5px] px-[7px] text-center text-ak-text-dim">{g.min > 0 ? fmtMinutes(g.min) : "-"}</td>
                      <td className="py-[5px] px-[7px] text-center font-black text-ak-red-text">{g.pts}</td>
                      <td className="py-[5px] px-[7px] text-center text-ak-text">{g.reb}</td>
                      <td className="py-[5px] px-[7px] text-center text-ak-text">{g.ast}</td>
                      <td className="py-[5px] px-[7px] text-center text-ak-text">{g.stl}</td>
                      <td className="py-[5px] px-[7px] text-center text-ak-text">{g.blk}</td>
                      <td className="py-[5px] px-[7px] text-center text-ak-text whitespace-nowrap">{g.fta > 0 ? `${g.ftm}/${g.fta}` : "-"}</td>
                      <td className="py-[5px] px-[7px] text-center font-black text-ak-gold">{g.eff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
