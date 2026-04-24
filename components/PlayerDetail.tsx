import { useState } from "react";
import Image from "next/image";
import { C, chartTooltipStyle } from "../lib/theme";
import { fmtMinutes } from "@/domain/shared/format";
import { LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "./Charts";

const playerImg = (player: any) => player.photoUrl || null;

export function StatCell({ label, value, highlight = false }: any) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-[10px] py-[10px] px-1 border",
        highlight
          ? "border-[#c0392b45] bg-[#8b1a1a20]"
          : "border-ak-border bg-ak-surface2",
      ].join(" ")}
    >
      <div className="text-[10px] font-black tracking-[0.12em] text-ak-text-dim">{label}</div>
      <div className={["text-[16px] font-black mt-0.5", highlight ? "text-ak-red-text" : "text-ak-text"].join(" ")}>
        {value}
      </div>
    </div>
  );
}

export function PlayerDetail({ player, onClose, activeSeason }: any) {
  const s = player.stats;
  const gameLog = player.gameLog || [];

  const seasons = ["All", ...Array.from(new Set<string>(gameLog.map((g: any) => g.season).filter(Boolean) as string[])).sort().reverse()];
  const leagues = ["All", ...Array.from(new Set<string>(gameLog.map((g: any) => g.league).filter(Boolean) as string[])).sort()];

  const [selSeason, setSelSeason] = useState("All");
  const [selLeague, setSelLeague] = useState("All");
  const [selStat,   setSelStat]   = useState("pts");
  const [showInfo,  setShowInfo]  = useState(false);
  const [logView,   setLogView]   = useState("chart");

  const STAT_OPTIONS = [
    { key:"pts", label:"PTS", color:C.redBright, activeClass:"border-[#c0392b80] bg-[#c0392b20] text-[#c0392b]" },
    { key:"reb", label:"REB", color:C.textSub,   activeClass:"border-[#a8a8ac80] bg-[#a8a8ac20] text-[#a8a8ac]" },
    { key:"ast", label:"AST", color:"#5ba4cf",   activeClass:"border-[#5ba4cf80] bg-[#5ba4cf20] text-[#5ba4cf]" },
    { key:"stl", label:"STL", color:C.green,     activeClass:"border-[#4caf7d80] bg-[#4caf7d20] text-[#4caf7d]" },
    { key:"blk", label:"BLK", color:"#a29bfe",   activeClass:"border-[#a29bfe80] bg-[#a29bfe20] text-[#a29bfe]" },
    { key:"eff", label:"EFF", color:"#fdcb6e",   activeClass:"border-[#fdcb6e80] bg-[#fdcb6e20] text-[#fdcb6e]" },
  ];

  const filtered = gameLog
    .filter((g: any) => (selSeason === "All" || g.season === selSeason) && (selLeague === "All" || g.league === selLeague))
    .map((g: any, i: number) => ({ ...g, label: `G${i + 1}` }));

  const activeStat = STAT_OPTIONS.find(o => o.key === selStat);
  const hasStats = s.gp > 0;

  const radarData = [
    { stat:"Scoring",    value: Math.min(100, Math.round((s.ppg / 20) * 100)) },
    { stat:"Rebounds",   value: Math.min(100, Math.round((s.rpg / 10) * 100)) },
    { stat:"Assists",    value: Math.min(100, Math.round((s.apg / 6)  * 100)) },
    { stat:"STL+BLK",   value: Math.min(100, Math.round(((s.spg + s.bpg) / 5) * 100)) },
    { stat:"Shooting",   value: Math.min(100, Math.round(s.fgPct)) },
    { stat:"Efficiency", value: Math.min(100, Math.round((s.eff / 20) * 100)) },
  ];

  // Filter button: boolean active state
  const filterBtn = (active: boolean) => [
    "py-[3px] px-[10px] text-[10px] font-black tracking-[0.1em] rounded-md border cursor-pointer font-sans",
    active
      ? "border-[#c0392b60] bg-[#8b1a1a25] text-ak-red-text"
      : "border-ak-border bg-transparent text-ak-text-dim",
  ].join(" ");

  // View toggle (chart/table): same shape as filterBtn
  const viewBtn = (v: string) => [
    "py-[2px] px-[9px] text-[10px] font-black tracking-[0.08em] rounded-[5px] border cursor-pointer font-sans uppercase",
    logView === v
      ? "border-[#c0392b60] bg-[#8b1a1a25] text-ak-red-text"
      : "border-ak-border bg-transparent text-ak-text-dim",
  ].join(" ");

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto pt-[80px] pb-8 px-4 bg-[rgba(10,10,10,0.88)] backdrop-blur-[6px]"
      onClick={onClose}
    >
      <div
        className="max-w-[680px] mx-auto rounded-2xl overflow-hidden border border-ak-border2 bg-ak-surface"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 flex gap-5 items-center bg-ak-base border-b border-ak-border">
          <div className="w-[72px] h-[72px] rounded-[14px] overflow-hidden shrink-0 bg-ak-surface border border-ak-border2 flex items-center justify-center text-[32px] relative">
            {playerImg(player)
              ? <Image src={playerImg(player)} alt={player.name} fill className="object-cover object-top" />
              : "🏀"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[22px] font-black text-ak-text">{player.name}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-[11px] font-black tracking-[0.12em] rounded-full py-[3px] px-3 text-ak-red-text bg-[#8b1a1a20] border border-[#c0392b40]">
                #{player.number}
              </span>
              <span className="text-[11px] font-bold text-ak-text-sub">{player.position}</span>
              {player.height && <span className="text-[11px] text-ak-text-dim">{player.height}</span>}
              {player.age && <span className="text-[11px] text-ak-text-dim">Age {player.age}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[28px] font-black text-ak-text-dim bg-transparent border-0 cursor-pointer self-start"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Season averages */}
          {hasStats && (
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
                <StatCell label="FG%"  value={s.fgPct > 0 ? `${s.fgPct}%` : "--"} />
                <StatCell label="2P%"  value={s.fg2Pct > 0 ? `${s.fg2Pct}%` : "--"} />
                <StatCell label="3P%"  value={s.fg3Pct > 0 ? `${s.fg3Pct}%` : "--"} />
                <StatCell label="FT"   value={s.ftaPg > 0 ? `${s.ftmPg}/${s.ftaPg}` : "--"} />
                <StatCell label="FT%"  value={s.ftPct > 0 ? `${s.ftPct}%` : "--"} />
                <StatCell label="MPG"  value={s.mpg > 0 ? fmtMinutes(s.mpg) : "--"} />
                <StatCell label="EFF"  value={s.eff} highlight />
              </div>
            </>
          )}

          {/* Season-by-season breakdown */}
          {activeSeason === "all-time" && player.seasonHistory && Object.keys(player.seasonHistory).length > 1 && (
            <div className="mb-6">
              <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-3 uppercase">
                Season by Season
              </div>
              <div className="rounded-[10px] border border-ak-border overflow-hidden">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-ak-base">
                      {["Season","GP","PPG","RPG","APG","FG%","EFF"].map(h => (
                        <th
                          key={h}
                          className={[
                            "py-[6px] px-[10px] font-black tracking-[0.1em] text-ak-text-dim border-b border-ak-border",
                            h === "Season" ? "text-left" : "text-center",
                          ].join(" ")}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(player.seasonHistory as Record<string, any>)
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .map(([sid, ss], i) => (
                        <tr key={sid} className={i % 2 === 0 ? "bg-ak-surface" : "bg-ak-base"}>
                          <td className="py-[6px] px-[10px] font-bold text-ak-text-sub">{sid.replace(/-/g,"-")}</td>
                          <td className="py-[6px] px-[10px] text-center text-ak-text-dim">{ss.gp}</td>
                          <td className="py-[6px] px-[10px] text-center font-black text-ak-red-text">{ss.ppg}</td>
                          <td className="py-[6px] px-[10px] text-center text-ak-text">{ss.rpg}</td>
                          <td className="py-[6px] px-[10px] text-center text-ak-text">{ss.apg}</td>
                          <td className="py-[6px] px-[10px] text-center text-ak-text">{ss.fgPct > 0 ? `${ss.fgPct}%` : "--"}</td>
                          <td className="py-[6px] px-[10px] text-center font-black text-ak-gold">{ss.eff}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Charts */}
          {hasStats && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              {/* Radar */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase">Skill Profile</div>
                  <button
                    onClick={() => setShowInfo(v => !v)}
                    className={[
                      "w-4 h-4 rounded-full border border-ak-border2 text-[10px] font-black cursor-pointer flex items-center justify-center leading-none p-0 font-sans",
                      showInfo ? "bg-[#8b1a1a25] text-ak-red-text" : "bg-transparent text-ak-text-dim",
                    ].join(" ")}
                    title="How is this calculated?"
                  >
                    ⓘ
                  </button>
                </div>

                {showInfo && (
                  <div className="mb-2 py-2 px-3 rounded-lg border border-ak-border bg-ak-base text-[11px] text-ak-text-sub leading-relaxed">
                    Each axis is scored 0-100 against a ceiling set for this level of gameplay: 20 PPG · 10 RPG · 6 APG · 5 STL+BLK · FG% direct · 20 EFF
                  </div>
                )}

                <div className="rounded-xl border border-ak-border p-2 bg-ak-base">
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData} margin={{ top:10, right:20, bottom:10, left:20 }}>
                      <PolarGrid stroke={C.border2} />
                      <PolarAngleAxis dataKey="stat" tick={{ fill:C.textSub, fontSize:10, fontWeight:700 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="value" stroke={C.redBright} fill={C.red} fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Game log */}
              {gameLog.length > 0 && (
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

                  {/* Stat selector -- per-stat active colours from build-time lookup map */}
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
                                  <td className="py-[5px] px-[7px] text-ak-text-dim whitespace-nowrap">{g.date ? g.date.slice(5) : "--"}</td>
                                  <td className="py-[5px] px-[7px] text-ak-text-sub max-w-[90px] overflow-hidden text-ellipsis whitespace-nowrap">{g.opponent || "--"}</td>
                                  <td className="py-[5px] px-[7px] text-center text-ak-text-dim">{g.min > 0 ? fmtMinutes(g.min) : "--"}</td>
                                  <td className="py-[5px] px-[7px] text-center font-black text-ak-red-text">{g.pts}</td>
                                  <td className="py-[5px] px-[7px] text-center text-ak-text">{g.reb}</td>
                                  <td className="py-[5px] px-[7px] text-center text-ak-text">{g.ast}</td>
                                  <td className="py-[5px] px-[7px] text-center text-ak-text">{g.stl}</td>
                                  <td className="py-[5px] px-[7px] text-center text-ak-text">{g.blk}</td>
                                  <td className="py-[5px] px-[7px] text-center text-ak-text whitespace-nowrap">{g.fta > 0 ? `${g.ftm}/${g.fta}` : "--"}</td>
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
              )}
            </div>
          )}

          {!hasStats && (
            <div className="text-center py-6 text-ak-text-dim">
              <div className="text-[13px]">No stats recorded yet for this player.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
