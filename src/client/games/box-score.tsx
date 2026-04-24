import { memo, useMemo, useEffect } from "react";
import { fmt } from "@/domain/players/format";
import { fmtMinutes } from "@/domain/shared/format";

const BOX_COLS = [
  { key: "min", label: "MIN" },
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TOV" },
  { key: "fgm", label: "FGM" },
  { key: "fga", label: "FGA" },
  { key: "fg3m", label: "3PM" },
  { key: "fg3a", label: "3PA" },
  { key: "ftm", label: "FTM" },
  { key: "fta", label: "FTA" },
  { key: "eff", label: "EFF" },
];

export const BoxScore = memo(function BoxScore({ game, players, onClose, isLoading, onPlayerClick }: any) {
  const playerMap = useMemo(() => new Map(players.map((p: any) => [p.id, p])), [players]);

  const rows = useMemo(() => {
    return (game.boxScore || [])
      .map((r: any) => ({ ...r, player: playerMap.get(r.pid) }))
      .filter((r: any) => r.player && r.min > 0);
  }, [game.boxScore, playerMap]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto pt-20 px-4 pb-8 bg-black/[0.82]" onClick={onClose}>
      <div className="max-w-[900px] mx-auto rounded-2xl border border-ak-border2 bg-ak-surface overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-[18px] flex justify-between items-center bg-ak-base border-b border-ak-border">
          <div>
            <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-0.5">{game.date}</div>
            <div className="text-[17px] font-black text-ak-text">
              {game.home ? "vs" : "@"} {game.opponent} · <span className={game.result === "W" ? "text-ak-green" : "text-ak-red-text"}>{game.result} {game.score}</span>
            </div>
            {(game.sourceUrl || game.youtubeUrl) && (
              <div className="flex gap-[10px] mt-2">
                {game.sourceUrl && (
                  <a href={game.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-ak-text-dim no-underline py-[3px] px-[10px] rounded-md border border-ak-border2 inline-flex items-center gap-[5px]"
                    onClick={e => e.stopPropagation()}>
                    Official Stats ↗
                  </a>
                )}
                {game.youtubeUrl && (
                  <a href={game.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-[#ff4444] no-underline py-[3px] px-[10px] rounded-md border border-[#ff444440] inline-flex items-center gap-[5px]"
                    onClick={e => e.stopPropagation()}>
                    Watch Replay ▶
                  </a>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-[28px] font-black text-ak-text-dim bg-transparent border-0 cursor-pointer">×</button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-ak-text-dim">
            <div className="text-sm font-bold">Loading box score...</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto pb-1">
              <table className="w-full border-collapse text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-ak-base border-b border-ak-border2">
                    <th className="px-3 py-2 text-left text-[10px] font-black text-ak-text-dim tracking-[0.12em] min-w-[48px]">#</th>
                    <th className="px-3 py-2 text-left text-[10px] font-black text-ak-text-dim tracking-[0.12em] min-w-[150px]">PLAYER</th>
                    {BOX_COLS.map(c => (
                      <th key={c.key} className={`px-2 py-2 text-[10px] font-black tracking-[0.1em] min-w-[44px] text-center ${c.key === "eff" ? "text-ak-red-text" : "text-ak-text-dim"}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any, i: number) => (
                    <tr key={r.pid} className={`border-b border-ak-border ${i % 2 === 0 ? "bg-ak-surface" : "bg-ak-surface2"}`}>
                      <td className="px-3 py-2 font-bold text-ak-text-dim">{r.player.number}</td>
                      <td className="px-3 py-2">
                        {onPlayerClick ? (
                          <button onClick={() => onPlayerClick(r.pid)} className="bg-transparent border-0 p-0 text-left cursor-pointer group">
                            <span className="font-bold text-ak-text text-[13px] block transition-colors duration-150 group-hover:text-ak-red-text">{fmt(r.player.name)}</span>
                            <span className="text-[10px] text-ak-text-dim tracking-[0.1em] block">{r.player.position}</span>
                          </button>
                        ) : (
                          <>
                            <div className="font-bold text-ak-text text-[13px]">{fmt(r.player.name)}</div>
                            <div className="text-[10px] text-ak-text-dim tracking-[0.1em]">{r.player.position}</div>
                          </>
                        )}
                      </td>
                      {BOX_COLS.map(c => (
                        <td
                          key={c.key}
                          className={`px-2 py-2 text-center ${c.key === "pts" || c.key === "eff" ? "font-black" : "font-normal"} ${
                            c.key === "eff"
                              ? (r[c.key] >= 15 ? "text-ak-red-text" : r[c.key] < 0 ? "text-[#ff4444]" : "text-ak-text-sub")
                              : c.key === "pts" && r.pts >= 15
                                ? "text-ak-red-text"
                                : "text-ak-text-sub"
                          }`}
                        >
                          {c.key === "min" ? (r.min > 0 ? fmtMinutes(r.min) : "--") : (r[c.key] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && (
              <div className="p-8 text-center text-ak-text-dim text-[13px]">No box score recorded for this game.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
});
