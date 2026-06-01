import { C, chartTooltipStyle } from "@/theme/tokens";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ShowMoreButton } from "./show-more-button";

export function TopScorersChart({ topScorers }: { topScorers: { name: string; ppg: number }[] }) {
  if (topScorers.length === 0) return null;
  return (
    <div
      className="rounded-2xl p-5 border border-ak-border bg-ak-surface shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
      role="img"
      aria-label="Top Scorers - PPG"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase">Top Scorers - PPG</div>
        <ShowMoreButton href="/players" className="show-more-btn">All Players -></ShowMoreButton>
      </div>
      <ResponsiveContainer width="100%" height={topScorers.length * 44}>
        <BarChart data={topScorers} layout="vertical" margin={{ top: 10, right: 40, left: 0, bottom: 10 }}>
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={C.red} />
              <stop offset="100%" stopColor={C.redBright} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
          <XAxis type="number" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: C.textSub, fontSize: 12, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
            width={130}
          />
          <Tooltip {...chartTooltipStyle} formatter={(v: any) => [`${v} PPG`]} />
          <Bar
            dataKey="ppg"
            fill="url(#barGrad)"
            radius={[0, 6, 6, 0]}
            maxBarSize={Math.min(40, 600 / topScorers.length)}
            label={{ position: "right", fill: C.textDim, fontSize: 11, fontWeight: 700 }}
            isAnimationActive={true}
          >
            {topScorers.map((_, i) => (
              <Cell key={i} fill={i === 0 ? C.redBright : "url(#barGrad)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
