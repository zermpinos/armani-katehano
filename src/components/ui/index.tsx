import React from "react";

// ── Section heading with red left bar ────────────────────────────────────────

interface SectionHeadingProps {
  label?: string;
  title: string;
  right?: React.ReactNode;
}

export function SectionHeading({ label, title, right }: SectionHeadingProps) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div className="flex items-start gap-3">
        <div className="w-1 self-stretch rounded-sm bg-ak-red-bright min-h-8" />
        <div>
          {label && (
            <div className="text-[11px] font-black tracking-[0.15em] mb-0.5 text-ak-red-text uppercase">
              {label}
            </div>
          )}
          <h2 className="text-[22px] font-black uppercase tracking-[-0.02em] text-ak-text">
            {title}
          </h2>
        </div>
      </div>
      {right && (
        <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim">{right}</div>
      )}
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  highlight?: boolean;
}

export function StatTile({ label, value, sub, highlight }: StatTileProps) {
  return (
    <div
      className={[
        "rounded-xl px-3 py-[14px] text-center border",
        highlight
          ? "border-[#c0392b55] bg-[#8b1a1a22]"
          : "border-ak-border bg-ak-surface",
      ].join(" ")}
    >
      <div className="text-[10px] font-black tracking-[0.15em] mb-1 text-ak-text-dim">{label}</div>
      <div className={["text-[28px] font-black", highlight ? "text-ak-red-text" : "text-ak-text"].join(" ")}>
        {value}
      </div>
      {sub && <div className="text-[11px] mt-0.5 text-ak-text-dim">{sub}</div>}
    </div>
  );
}
