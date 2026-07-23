import { C, chartTooltipStyle } from "@/theme/tokens";
import { LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export function TrendLineChart({ data, gradientId, height }: { data: any[]; gradientId: string; height: number | `${number}%` }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.redBright} stopOpacity={0.25} />
            <stop offset="100%" stopColor={C.red} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke={C.border2} vertical={false} />
        <XAxis dataKey="idx" tick={false} axisLine={{ stroke: C.border2 }} tickLine={false} />
        <YAxis width={32} tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
        <Tooltip
          {...chartTooltipStyle}
          content={({ active, payload }: any) => {
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
        <Area type="monotone" dataKey="pts" stroke="none" fill={`url(#${gradientId})`} legendType="none" />
        <Line type="monotone" dataKey="pts" stroke={C.redBright} strokeWidth={3} dot={{ fill: C.redBright, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} name="AK" />
        <Line type="monotone" dataKey="opp" stroke={C.silver} strokeWidth={2} dot={{ fill: C.silver, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 5" name="OPP" />
        <Legend wrapperStyle={{ fontSize: 11, color: C.textSub }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
