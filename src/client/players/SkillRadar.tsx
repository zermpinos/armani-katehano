/* eslint-disable security/detect-object-injection -- indexes its own fixed AXES/values arrays by the active axis number; no user-controlled sinks */
import { useState } from "react";
import { C } from "@/theme/tokens";

const AXES = [
  { label: "Scoring",    max: 20,  get: (s: any) => s.ppg,         fmt: (s: any) => `${s.ppg.toFixed(1)} PPG` },
  { label: "Rebounds",   max: 10,  get: (s: any) => s.rpg,         fmt: (s: any) => `${s.rpg.toFixed(1)} RPG` },
  { label: "Assists",    max: 6,   get: (s: any) => s.apg,         fmt: (s: any) => `${s.apg.toFixed(1)} APG` },
  { label: "STL+BLK",    max: 5,   get: (s: any) => s.spg + s.bpg, fmt: (s: any) => `${(s.spg + s.bpg).toFixed(1)} per game` },
  { label: "Shooting",   max: 100, get: (s: any) => s.fgPct,       fmt: (s: any) => `${Math.round(s.fgPct)}% FG` },
  { label: "Efficiency", max: 20,  get: (s: any) => s.eff,         fmt: (s: any) => `${s.eff.toFixed(1)} EFF` },
];

const N = AXES.length;
const CX = 100, CY = 100, R = 62;
const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
const pt = (i: number, frac: number): [number, number] => [CX + R * frac * Math.cos(ang(i)), CY + R * frac * Math.sin(ang(i))];

export function SkillRadar({ s }: any) {
  const [showInfo, setShowInfo] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  const values = AXES.map(a => Math.min(100, Math.round((a.get(s) / a.max) * 100)));
  const polygon = values.map((v, i) => pt(i, v / 100).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1].map(f => AXES.map((_, i) => pt(i, f).join(",")).join(" "));

  const activeAxis = active === null ? null : AXES[active];

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim uppercase">Skill Profile</div>
        <button
          onClick={() => setShowInfo(v => !v)}
          className={[
            "w-4 h-4 rounded-full border border-ak-border2 text-[10px] font-black cursor-pointer flex items-center justify-center leading-none p-0 font-sans",
            showInfo ? "bg-[#8b1a1a25] text-ak-red-text" : "bg-transparent text-ak-text-dim",
          ].join(" ")}
          title="How is this calculated?"
        >
          ⓘ
        </button>
      </div>

      {showInfo && (
        <div className="mb-2 py-2 px-3 rounded-lg border border-ak-border bg-ak-base text-[11px] text-ak-text-sub leading-relaxed">
          Each axis is scored 0-100 against a ceiling set for this level of gameplay: 20 PPG · 10 RPG · 6 APG · 5 STL+BLK · FG% direct · 20 EFF
        </div>
      )}

      <div className="rounded-xl border border-ak-border p-2 bg-ak-base">
        <svg viewBox="0 0 200 200" width="100%" height="200" preserveAspectRatio="xMidYMid meet" className="block overflow-visible" role="img" aria-label="Skill profile radar">
          {rings.map((r, i) => (
            <polygon key={i} points={r} fill="none" stroke={C.border2} strokeWidth={0.5} />
          ))}
          {AXES.map((_, i) => {
            const [x, y] = pt(i, 1);
            return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke={C.border2} strokeWidth={0.5} />;
          })}
          <polygon points={polygon} fill={C.red} fillOpacity={0.15} stroke={C.redBright} strokeWidth={2} strokeLinejoin="round" />
          {values.map((v, i) => {
            const [x, y] = pt(i, v / 100);
            return <circle key={i} cx={x} cy={y} r={active === i ? 3.6 : 2.2} fill={C.redBright} />;
          })}
          {AXES.map((a, i) => {
            const [x, y] = pt(i, 1.17);
            const c = Math.cos(ang(i));
            const anchor = c > 0.3 ? "start" : c < -0.3 ? "end" : "middle";
            return (
              <text key={i} x={x} y={y} fontSize={8} fontWeight={700} fill={active === i ? C.redText : C.textSub} textAnchor={anchor} dominantBaseline="middle">
                {a.label}
              </text>
            );
          })}
          {AXES.map((_, i) => {
            const [x, y] = pt(i, 1);
            return (
              <line key={`hit-${i}`} x1={CX} y1={CY} x2={x} y2={y} stroke="transparent" strokeWidth={26}
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onPointerDown={() => setActive(i)} />
            );
          })}
        </svg>
        <div className="mt-0.5 text-center text-[11px] leading-4 min-h-4">
          {activeAxis ? (
            <span>
              <span className="font-bold text-ak-red-text">{activeAxis.label}</span>{" "}
              <span className="text-ak-text-sub">{activeAxis.fmt(s)}</span>
            </span>
          ) : (
            <span className="text-ak-text-dim">Hover or tap an axis for the number</span>
          )}
        </div>
      </div>
    </div>
  );
}
