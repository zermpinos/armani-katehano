import { useState } from "react";
import { C } from "@/theme/tokens";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

export function SkillRadar({ s }: any) {
  const [showInfo, setShowInfo] = useState(false);

  const radarData = [
    { stat:"Scoring",    value: Math.min(100, Math.round((s.ppg / 20) * 100)) },
    { stat:"Rebounds",   value: Math.min(100, Math.round((s.rpg / 10) * 100)) },
    { stat:"Assists",    value: Math.min(100, Math.round((s.apg / 6)  * 100)) },
    { stat:"STL+BLK",   value: Math.min(100, Math.round(((s.spg + s.bpg) / 5) * 100)) },
    { stat:"Shooting",   value: Math.min(100, Math.round(s.fgPct)) },
    { stat:"Efficiency", value: Math.min(100, Math.round((s.eff / 20) * 100)) },
  ];

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
          Each axis is scored 0–100 against a ceiling set for this level of gameplay: 20 PPG · 10 RPG · 6 APG · 5 STL+BLK · FG% direct · 20 EFF
        </div>
      )}

      <div className="rounded-xl border border-ak-border p-2 bg-ak-base">
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData} margin={{ top:10, right:20, bottom:10, left:20 }}>
            <PolarGrid stroke={C.border2} />
            <PolarAngleAxis dataKey="stat" tick={{ fill:C.textSub, fontSize:10, fontWeight:700 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke={C.redBright} fill={C.red} fillOpacity={0.15} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
