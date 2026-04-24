import type { ReactNode } from "react";

const BTN_VARIANT: Record<string, string> = {
  primary:   "bg-ak-red border-transparent text-ak-text",
  danger:    "bg-[#7f1d1d] border-transparent text-ak-text",
  ghost:     "bg-transparent border-ak-border2 text-ak-text-sub",
  secondary: "bg-ak-surface2 border-transparent text-ak-text",
  green:     "bg-ak-green border-transparent text-ak-text",
};

const BTN_SIZE: Record<string, string> = {
  sm: "py-[6px] px-3 text-[11px]",
  md: "py-[9px] px-[18px] text-[13px]",
};

export function Btn({ onClick, disabled = false, children, variant = "primary", size = "md" }: { onClick?: () => void; disabled?: boolean; children: ReactNode; variant?: string; size?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className={[
      "font-black tracking-[0.12em] rounded-lg border font-sans transition-opacity duration-150",
      BTN_VARIANT[variant] ?? BTN_VARIANT.primary,
      BTN_SIZE[size] ?? BTN_SIZE.md,
      disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer opacity-100",
    ].join(" ")}>
      {children}
    </button>
  );
}

export function F({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-1">{label}</span>
      <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full py-[7px] px-[10px] text-xs rounded-[7px] border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none" />
    </label>
  );
}

export function Sel({ label, value, onChange, options = [] }: { label: string; value: string; onChange: (v: string) => void; options?: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="block text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-1">{label}</span>
      <select value={value ?? ""} onChange={e => onChange(e.target.value)}
        className="w-full py-[7px] px-[10px] text-xs rounded-[7px] border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
