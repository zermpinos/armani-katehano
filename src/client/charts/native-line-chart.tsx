/* eslint-disable security/detect-object-injection -- reads its own data arrays by numeric index and caller-supplied series keys; no user-controlled write sinks */
import { useState, type ReactNode } from "react";
import { C } from "@/theme/tokens";

export interface LineSeries {
  key: string;
  color: string;
  label: string;
  dashed?: boolean;
}

const VW = 1000;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 12;

function niceNum(range: number, round: boolean) {
  const exp = Math.floor(Math.log10(range || 1));
  const f = range / Math.pow(10, exp);
  const nf = round
    ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10)
    : (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10);
  return nf * Math.pow(10, exp);
}

function niceTicks(lo: number, hi: number, count: number): number[] {
  if (lo === hi) { lo -= 1; hi += 1; }
  const step = niceNum(niceNum(hi - lo, false) / Math.max(1, count - 1), true);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step * 0.5; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

function thin(n: number, target: number): number[] {
  if (n <= target) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (target - 1);
  const set = new Set<number>();
  for (let i = 0; i < target; i++) set.add(Math.round(i * step));
  return [...set];
}

// Monotone cubic (Fritsch-Carlson): a smooth curve that never overshoots the
// data, so it adds no peak or dip that the underlying points do not have.
export function smoothPath(pts: Array<[number, number]>): string {
  const n = pts.length;
  if (n === 1) return `M ${pts[0][0]},${pts[0][1]}`;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const dx: number[] = [], slope: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i]; slope[i] = (ys[i + 1] - ys[i]) / dx[i]; }
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }
  let d = `M ${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${xs[i] + h},${ys[i] + m[i] * h} ${xs[i + 1] - h},${ys[i + 1] - m[i + 1] * h} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

export function NativeLineChart({ data, series, height, xLabelKey, tooltip }: {
  data: any[];
  series: LineSeries[];
  height: number;
  xLabelKey?: string;
  tooltip: (row: any) => ReactNode;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  if (n === 0) return null;

  const padB = xLabelKey ? 24 : 12;
  const plotW = VW - PAD_L - PAD_R;
  const plotH = height - PAD_T - padB;

  const nums: number[] = [];
  for (const s of series) for (const row of data) {
    const v = row[s.key];
    if (typeof v === "number" && !Number.isNaN(v)) nums.push(v);
  }
  const ticks = niceTicks(Math.min(...nums), Math.max(...nums), 4);
  const lo = ticks[0], hi = ticks[ticks.length - 1];

  const xAt = (i: number) => PAD_L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * plotH;
  const pctX = (i: number) => (xAt(i) / VW) * 100;
  const pctY = (v: number) => (yAt(v) / height) * 100;

  return (
    <div className="relative w-full select-none" style={{ height }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${height}`} preserveAspectRatio="none" className="block">
        {ticks.map((t, i) => (
          <line key={i} x1={PAD_L} x2={VW - PAD_R} y1={yAt(t)} y2={yAt(t)}
                stroke={C.border} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        ))}
        {series.map(s => (
          <path key={s.key} d={smoothPath(data.map((row, i): [number, number] => [xAt(i), yAt(row[s.key])]))}
                fill="none" stroke={s.color} strokeWidth={s.dashed ? 2 : 2.5}
                strokeDasharray={s.dashed ? "7 5" : undefined}
                strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      {ticks.map((t, i) => (
        <div key={i} className="absolute text-[10px] text-ak-text-dim text-right pr-1 -translate-y-1/2 pointer-events-none tabular-nums"
             style={{ left: 0, width: `${(PAD_L / VW) * 100}%`, top: `${pctY(t)}%` }}>
          {String(Math.round(t * 10) / 10)}
        </div>
      ))}

      {xLabelKey && thin(n, 6).map(i => (
        <div key={i} className="absolute bottom-0 text-[10px] text-ak-text-dim -translate-x-1/2 pointer-events-none whitespace-nowrap"
             style={{ left: `${pctX(i)}%` }}>
          {data[i][xLabelKey]}
        </div>
      ))}

      {series.map(s => data.map((row, i) => (
        <span key={`${s.key}-${i}`} className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${pctX(i)}%`, top: `${pctY(row[s.key])}%`, width: 5, height: 5, background: s.color }} />
      )))}

      <div className="absolute inset-0" style={{ touchAction: "pan-y" }}
           onPointerMove={e => {
             const r = e.currentTarget.getBoundingClientRect();
             const rel = ((e.clientX - r.left) / r.width) * VW;
             const i = Math.round(((rel - PAD_L) / plotW) * (n - 1));
             setHover(Math.max(0, Math.min(n - 1, i)));
           }}
           onPointerLeave={() => setHover(null)}
      />

      {hover !== null && (
        <>
          <div className="absolute top-0 bottom-0 w-px bg-ak-border2 pointer-events-none" style={{ left: `${pctX(hover)}%` }} />
          {series.map(s => (
            <span key={s.key} className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left: `${pctX(hover)}%`, top: `${pctY(data[hover][s.key])}%`, width: 9, height: 9, background: s.color, boxShadow: `0 0 0 2px ${C.base}` }} />
          ))}
          <div className="absolute top-1 z-10 pointer-events-none"
               style={{ left: `${pctX(hover)}%`, transform: `translateX(${pctX(hover) > 66 ? "-100%" : pctX(hover) < 34 ? "0%" : "-50%"})` }}>
            {tooltip(data[hover])}
          </div>
        </>
      )}
    </div>
  );
}
