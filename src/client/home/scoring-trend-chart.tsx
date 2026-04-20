import { C, chartTooltipStyle } from "../../../lib/theme";
import { LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "../../../components/Charts";
import { ShowMoreButton } from "./show-more-button";

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
        <ShowMoreButton className="show-more-btn" onClick={onShowMore}>Show More -></ShowMoreButton>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.redBright} stopOpacity={0.25}/>
              <stop offset="100%" stopColor={C.red} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={C.border2} vertical={false} />
          <XAxis dataKey="idx" tick={false} axisLine={{ stroke: C.border2 }} tickLine={false} />
          <YAxis width={32} tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
          <Tooltip
            {...chartTooltipStyle}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const entries = payload.filter((p: any) => p.name === "AK" || p.name === "OPP");
              if (!entries.length) return null;
              const game = payload[0]?.payload?.game;
              return (
                <div className="bg-ak-surface2 border border-ak-border2 rounded-lg text-xs text-ak-text">
                  {game && <div className="text-[10px] text-ak-text-dim mb-1">{game}</div>}
                  {entries.map((p: any) => (
                    <div key={p.name} className={p.name === "AK" ? "text-ak-red-bright" : "text-ak-silver"}>{p.name}: {p.value}</div>
                  ))}
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="pts" stroke="none" fill="url(#trendFill)" legendType="none" />
          <Line type="monotone" dataKey="pts" stroke={C.redBright} strokeWidth={3} dot={{ fill: C.redBright, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} name="AK" />
          <Line type="monotone" dataKey="opp" stroke={C.silver} strokeWidth={2} dot={{ fill: C.silver, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 5" name="OPP" />
          <Legend wrapperStyle={{ fontSize: 11, color: C.textSub }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
