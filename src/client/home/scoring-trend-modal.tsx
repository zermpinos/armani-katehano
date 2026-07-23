import { TrendLineChart } from "./trend-line-chart";

export function ScoringTrendModal({ show, onClose, extendedTrend, trendRange, setTrendRange, totalGames }: {
  show: boolean;
  onClose: () => void;
  extendedTrend: any[];
  trendRange: number;
  setTrendRange: (n: number) => void;
  totalGames: number;
}) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4 trend-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="rounded-2xl p-[clamp(16px,4vw,32px)] bg-ak-surface border border-ak-border max-w-[95vw] w-full max-h-[90vh] flex flex-col shadow-[0_20px_64px_rgba(0,0,0,0.3)] min-h-0 trend-modal-content">
        <div className="flex items-start justify-between mb-[clamp(16px,3vw,24px)] gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-1">Scoring Trend</div>
            <div className="text-[clamp(18px,5vw,22px)] font-bold text-ak-text">Last {extendedTrend.length} Games</div>
          </div>
          <button
            onClick={onClose}
            className="w-[clamp(32px,8vw,40px)] h-[clamp(32px,8vw,40px)] min-w-8 min-h-8 rounded-lg border border-ak-border bg-ak-base text-ak-text text-[clamp(16px,4vw,20px)] cursor-pointer flex items-center justify-center transition-all duration-200 shrink-0 hover:bg-ak-red-text hover:border-ak-red-text hover:text-ak-surface"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(70px,1fr))] gap-2 mb-[clamp(16px,3vw,24px)] trend-buttons">
          {[10, 20, 30].map(range => (
            <button
              key={range}
              onClick={() => setTrendRange(range)}
              className={`py-[clamp(6px,2vw,8px)] px-[clamp(12px,3vw,16px)] rounded-lg border text-[clamp(11px,2.5vw,13px)] font-bold cursor-pointer transition-all duration-200 ${
                trendRange === range
                  ? "border-ak-red-text bg-[#e0555515] text-ak-red-text"
                  : "border-ak-border bg-ak-base text-ak-text hover:border-ak-red-text hover:bg-[#e0555508]"
              }`}
            >
              Last {range}
            </button>
          ))}
          <button
            onClick={() => setTrendRange(totalGames)}
            className={`py-[clamp(6px,2vw,8px)] px-[clamp(12px,3vw,16px)] rounded-lg border text-[clamp(11px,2.5vw,13px)] font-bold cursor-pointer transition-all duration-200 ${
              trendRange === totalGames
                ? "border-ak-red-text bg-[#e0555515] text-ak-red-text"
                : "border-ak-border bg-ak-base text-ak-text hover:border-ak-red-text hover:bg-[#e0555508]"
            }`}
          >
            All Games
          </button>
        </div>
        <div className="overflow-x-auto overflow-y-hidden -mr-2 pr-2">
          <div className="min-w-[500px]">
            <TrendLineChart data={extendedTrend} height={360} />
          </div>
        </div>
      </div>
    </div>
  );
}
