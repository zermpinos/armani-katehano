import { fmtDate } from "@/domain/shared/format";
import { ShowMoreButton } from "./show-more-button";

export function RecentResultsCard({ recentGames }: { recentGames: any[] }) {
  if (recentGames.length === 0) return null;
  return (
    <div className="rounded-2xl p-5 border border-ak-border bg-ak-surface shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
      <div className="mb-[14px] flex items-start justify-between">
        <div>
          <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase">Recent Results</div>
          <div className="text-lg font-bold text-ak-text mt-0.5">Last {recentGames.length} Games</div>
        </div>
        <ShowMoreButton href="/games" className="show-more-btn">All Games -></ShowMoreButton>
      </div>

      {/* Featured: most recent game */}
      {(() => {
        const g = recentGames[0];
        const isWin = g.result === "W";
        return (
          <div className={`rounded-xl py-[14px] px-4 mb-2 border flex items-center justify-between gap-3 ${
            isWin ? "border-[#4caf7d30] bg-[rgba(16,185,129,0.06)]" : "border-[#e0555525] bg-[#8b1a1a08]"
          }`}>
            <div className="flex items-center gap-3">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-black shrink-0 border ${
                isWin
                  ? "bg-[rgba(16,185,129,0.15)] text-[#6ee7b7] border-[rgba(16,185,129,0.25)]"
                  : "bg-[#8b1a1a35] text-ak-red-text border-[#e0555530]"
              }`}>{g.result}</span>
              <div>
                <div className="text-[15px] font-extrabold text-ak-text">{g.home ? "vs" : "@"} {g.opponent}</div>
                <div className="text-[11px] text-ak-text-dim mt-0.5">{fmtDate(g.date)}</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-xl font-black ${isWin ? "text-ak-green" : "text-ak-red-text"}`}>{g.score}</div>
            </div>
          </div>
        );
      })()}

      {/* Compact: remaining games */}
      <div className="flex flex-col">
        {recentGames.slice(1).map((g: any) => {
          const isWin = g.result === "W";
          return (
            <div key={g.id} className="flex items-center justify-between gap-[10px] py-[9px] px-1 border-t border-ak-border">
              <div className="flex items-center gap-[9px]">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                  isWin ? "bg-[rgba(16,185,129,0.10)] text-[#6ee7b7]" : "bg-[#8b1a1a25] text-ak-red-text"
                }`}>{g.result}</span>
                <div>
                  <div className="text-xs font-semibold text-ak-text-sub">{g.home ? "vs" : "@"} {g.opponent}</div>
                  <div className="text-[10px] text-ak-text-dim">{fmtDate(g.date)}</div>
                </div>
              </div>
              <div className="text-xs font-bold text-ak-text-sub">{g.score}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
