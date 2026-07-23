import { ShowMoreButton } from "./show-more-button";
import { TrendLineChart } from "./trend-line-chart";

interface TrendPoint {
  idx: number;
  game: string;
  pts: number;
  opp: number;
  result: string;
}

interface Props {
  trend: TrendPoint[];
  onShowMore: () => void;
}

export function ScoringTrendChart({ trend, onShowMore }: Props) {
  if (trend.length === 0) return null;
  return (
    <div className="rounded-2xl p-5 border border-ak-border bg-ak-surface shadow-[0_4px_16px_rgba(0,0,0,0.25)] flex flex-col min-h-[320px]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase">Scoring Trend</div>
          <div className="text-lg font-bold text-ak-text">Last {trend.length} Games</div>
        </div>
        <ShowMoreButton className="show-more-btn" onClick={onShowMore}>Show More →</ShowMoreButton>
      </div>
      <TrendLineChart data={trend} gradientId="trendFill" height={260} />
    </div>
  );
}
