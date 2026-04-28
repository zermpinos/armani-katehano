import { C, chartTooltipStyle } from "@/theme/tokens";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { fmtMinutes } from "@/domain/shared/format";

export function MinutesChart({ minutesDist }: { minutesDist: { name: string; mpg: number; highlight?: boolean }[] }) {
  if (minutesDist.length === 0) return null;
  return (
    <div
      className="rounded-xl p-5 border border-ak-border bg-ak-surface"
      role="img"
      aria-label="Minutes Distribution Chart (MPG)"
    >
      <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-4 uppercase">Minutes Distribution (MPG)</div>
      <ResponsiveContainer width="100%" height={minutesDist.length * 40}>
        <BarChart
          data={minutesDist}
          layout="vertical"
          margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: C.textDim, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[0, 40]}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: C.textSub, fontSize: 12, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
            width={130}
          />
          <Tooltip
            {...chartTooltipStyle}
            formatter={(value) => [fmtMinutes(value as number)]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
          />
          <Bar
            dataKey="mpg"
            radius={[0, 4, 4, 0]}
            maxBarSize={Math.min(40, 600 / minutesDist.length)}
            label={{ position: "right", fill: C.textDim, fontSize: 11, fontWeight: 700, formatter: (v: any) => fmtMinutes(v) }}
            isAnimationActive={true}
          >
            {minutesDist.map((entry, i) => (
              <Cell key={i} fill={entry.highlight || i === 0 ? C.redBright : C.red} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
