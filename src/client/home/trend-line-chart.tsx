import { C } from "@/theme/tokens";
import { NativeLineChart, type LineSeries } from "@/client/charts/native-line-chart";

const SERIES: LineSeries[] = [
  { key: "pts", color: C.redBright, label: "AK" },
  { key: "opp", color: C.silver, label: "OPP", dashed: true },
];

export function TrendLineChart({ data, height }: { data: any[]; height: number }) {
  return (
    <div>
      <NativeLineChart
        data={data}
        series={SERIES}
        height={height}
        tooltip={(row) => (
          <div className="bg-ak-surface2 border border-ak-border2 rounded-lg px-2.5 py-1.5 text-xs text-ak-text shadow-lg whitespace-nowrap">
            {row.game && <div className="text-[10px] text-ak-text-dim mb-1">{row.game}</div>}
            <div className="text-ak-red-bright font-semibold">AK: {row.pts}</div>
            <div className="text-ak-silver">OPP: {row.opp}</div>
          </div>
        )}
      />
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-ak-text-sub">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-[3px] rounded" style={{ background: C.redBright }} />AK</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-[2px] rounded" style={{ background: C.silver }} />OPP</span>
      </div>
    </div>
  );
}
