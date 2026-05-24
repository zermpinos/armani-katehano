import { memo } from "react";
import Link from "next/link";
import { fmt } from "@/domain/players/format";
import { fmtMinutes } from "@/domain/shared/format";

const BOX_COLS = [
  { key: "min",  label: "MIN" },
  { key: "pts",  label: "PTS" },
  { key: "reb",  label: "REB" },
  { key: "ast",  label: "AST" },
  { key: "stl",  label: "STL" },
  { key: "blk",  label: "BLK" },
  { key: "tov",  label: "TOV" },
  { key: "fgm",  label: "FGM" },
  { key: "fga",  label: "FGA" },
  { key: "fg3m", label: "3PM" },
  { key: "fg3a", label: "3PA" },
  { key: "ftm",  label: "FTM" },
  { key: "fta",  label: "FTA" },
  { key: "eff",  label: "EFF" },
];

export const BoxScoreTable = memo(function BoxScoreTable({ game }: { game: any }) {
  return (
    <div className="rounded-2xl border border-ak-border2 bg-ak-surface overflow-hidden">
      <div className="px-6 py-[18px] bg-ak-base border-b border-ak-border">
        <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-0.5">{game.date}</div>
        <div className="text-[17px] font-black text-ak-text">
          {game.home ? "vs" : "@"} {game.opponent} ·{" "}
          <span className={game.result === "W" ? "text-ak-green" : "text-ak-red-text"}>
            {game.result} {game.score}
          </span>
        </div>
        {(game.sourceUrl || game.youtubeUrl) && (
          <div className="flex gap-[10px] mt-2">
            {game.sourceUrl && (
              <a
                href={game.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-ak-text-dim no-underline py-[3px] px-[10px] rounded-md border border-ak-border2 inline-flex items-center gap-[5px]"
              >
                Official Stats ↗
              </a>
            )}
            {game.youtubeUrl && (
              <a
                href={game.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-[#ff4444] no-underline py-[3px] px-[10px] rounded-md border border-[#ff444440] inline-flex items-center gap-[5px]"
              >
                Watch Replay ▶
              </a>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-1">
        <table className="w-full border-collapse text-xs min-w-[700px]">
          <thead>
            <tr className="bg-ak-base border-b border-ak-border2">
              <th className="px-3 py-2 text-left text-[10px] font-black text-ak-text-dim tracking-[0.12em] min-w-[48px]">#</th>
              <th className="px-3 py-2 text-left text-[10px] font-black text-ak-text-dim tracking-[0.12em] min-w-[150px]">PLAYER</th>
              {BOX_COLS.map(c => (
                <th
                  key={c.key}
                  className={`px-2 py-2 text-[10px] font-black tracking-[0.1em] min-w-[44px] text-center ${
                    c.key === "eff" ? "text-ak-red-text" : "text-ak-text-dim"
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {game.boxScore.map((r: any, i: number) => (
              <tr key={r.pid} className={`border-b border-ak-border ${i % 2 === 0 ? "bg-ak-surface" : "bg-ak-surface2"}`}>
                <td className="px-3 py-2 font-bold text-ak-text-dim">{r.number}</td>
                <td className="px-3 py-2">
                  <Link href={`/players/${r.slug}`} className="group">
                    <span className="font-bold text-ak-text text-[13px] block transition-colors duration-150 group-hover:text-ak-red-text">
                      {fmt(r.name)}
                    </span>
                    <span className="text-[10px] text-ak-text-dim tracking-[0.1em] block">{r.position}</span>
                  </Link>
                </td>
                {BOX_COLS.map(c => (
                  <td
                    key={c.key}
                    className={`px-2 py-2 text-center ${
                      c.key === "pts" || c.key === "eff" ? "font-black" : "font-normal"
                    } ${
                      c.key === "eff"
                        ? r[c.key] >= 15
                          ? "text-ak-red-text"
                          : r[c.key] < 0
                            ? "text-[#ff4444]"
                            : "text-ak-text-sub"
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
      {game.boxScore.length === 0 && (
        <div className="p-8 text-center text-ak-text-dim text-[13px]">No box score recorded for this game.</div>
      )}
    </div>
  );
});
