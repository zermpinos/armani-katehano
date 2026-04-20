import { useState } from "react";
import { getCountdownInfo } from "@/client/home/calendar-utils";
import { fmt } from "../../../lib/utils";

const PAGE_SIZE = 10;

function formatTopScorer(topScorer: any) {
  if (!topScorer || !topScorer.pts) return null;
  return `${fmt(topScorer.name)} ${topScorer.pts} PTS`;
}

interface Props {
  items: any[];
  loadingBoxScore: boolean;
  onGameClick: (game: any) => void;
  onUpcomingClick: (game: any) => void;
  seasonLeagues: any[];
  selectedLeague: string;
}

export function GamesTable({ items, loadingBoxScore, onGameClick, onUpcomingClick, seasonLeagues, selectedLeague }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pagedItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className="flex flex-col gap-2">
        {pagedItems.map((g: any) => {
          if (g._upcoming) {
            const { label, tier } = getCountdownInfo(g.scheduledFor);
            const accentCls = tier === "today" ? "text-ak-gold" : tier === "week" ? "text-ak-red-text" : "text-ak-text-sub";
            return (
              <button
                key={`upcoming-${g.id ?? g.scheduledFor}`}
                onClick={() => onUpcomingClick(g)}
                className="flex items-center justify-between py-[14px] px-[18px] rounded-xl border border-[#c9a84c30] bg-[#c9a84c08] cursor-pointer text-left transition-[border-color,background] duration-150 hover:border-[#c9a84c60] hover:bg-[#c9a84c14]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-sm font-black shrink-0 bg-[#c9a84c15] text-ak-gold border border-[#c9a84c35]">▸</span>
                  <div>
                    <div className="text-sm font-bold text-ak-text">{g.location === "home" ? "vs" : "@"} {g.opponent}</div>
                    <div className={`text-[11px] mt-0.5 font-bold ${accentCls}`}>{label}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-[13px] font-bold text-ak-text-sub">{g.scheduledFor.slice(0, 10)}</div>
                    {g.competition && <div className="text-[11px] text-ak-text-dim">{g.competition}</div>}
                  </div>
                  <div className="text-[11px] text-ak-gold font-bold">UPCOMING →</div>
                </div>
              </button>
            );
          }

          const topScorer = formatTopScorer(g.topScorer);
          return (
            <button
              key={g.id}
              onClick={() => onGameClick(g)}
              disabled={loadingBoxScore}
              className="flex items-center justify-between py-[14px] px-[18px] rounded-xl border border-ak-border bg-ak-surface cursor-pointer text-left transition-[border-color] duration-150 hover:border-[#c0392b55]"
            >
              <div className="flex items-center gap-3">
                <span className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-xs font-black shrink-0 border ${
                  g.result === "W"
                    ? "bg-[#4caf7d20] text-ak-green border-[#4caf7d40]"
                    : "bg-[#8b1a1a30] text-ak-red-text border-[#e0555530]"
                }`}>{g.result}</span>
                <div>
                  <div className="text-sm font-bold text-ak-text">{g.home ? "vs" : "@"} {g.opponent}</div>
                  <div className="text-[11px] text-ak-text-dim mt-0.5">
                    {g.date}
                    {seasonLeagues.length > 1 && selectedLeague === "all" && (
                      <span className="ml-2 text-ak-text-dim opacity-70">{g.leagueName}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-lg font-black text-ak-text">{g.score}</div>
                  {topScorer && <div className="text-[11px] text-ak-text-dim">{topScorer}</div>}
                </div>
                <div className="text-[11px] text-ak-text-dim">BOX SCORE →</div>
              </div>
            </button>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-0.5">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
            className={`py-[7px] px-[18px] rounded-lg bg-transparent border transition-all duration-150 text-base font-black leading-none ${
              page === 0
                ? "border-ak-border text-ak-text-dim cursor-default opacity-30"
                : "border-ak-border2 text-ak-text cursor-pointer"
            }`}
          >‹</button>
          <span className="text-[11px] font-bold text-ak-text-dim tracking-[0.1em]">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, items.length)} of {items.length}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1}
            className={`py-[7px] px-[18px] rounded-lg bg-transparent border transition-all duration-150 text-base font-black leading-none ${
              page >= totalPages - 1
                ? "border-ak-border text-ak-text-dim cursor-default opacity-30"
                : "border-ak-border2 text-ak-text cursor-pointer"
            }`}
          >›</button>
        </div>
      )}
    </>
  );
}
