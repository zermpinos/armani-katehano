import { useState, type ReactNode } from "react";

const BTN_VARIANT: Record<string, string> = {
  primary:   "bg-ak-red border-transparent text-ak-text",
  danger:    "bg-[#7f1d1d] border-transparent text-ak-text",
  ghost:     "bg-transparent border-ak-border2 text-ak-text-sub",
  secondary: "bg-ak-surface2 border-transparent text-ak-text",
  green:     "bg-ak-green border-transparent text-ak-text",
};

const BTN_SIZE: Record<string, string> = {
  sm: "min-h-[44px] py-2 px-3 text-[11px]",
  md: "min-h-[44px] py-[9px] px-[18px] text-[13px]",
};

const LABEL = "block text-[11px] font-black tracking-[0.12em] text-ak-text-dim uppercase mb-1";
const CONTROL = "w-full min-h-[44px] py-2 px-3 text-base rounded-[7px] border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none focus-visible:border-ak-red-bright";

export function Btn({ onClick, disabled = false, children, variant = "primary", size = "md" }: { onClick?: () => void; disabled?: boolean; children: ReactNode; variant?: string; size?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className={[
      "font-black tracking-[0.12em] rounded-lg border font-sans transition-opacity duration-150",
      (Reflect.get(BTN_VARIANT, variant) ?? BTN_VARIANT.primary) as string,
      (Reflect.get(BTN_SIZE, size) ?? BTN_SIZE.md) as string,
      disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer opacity-100",
    ].join(" ")}>
      {children}
    </button>
  );
}

export function F({ label, value, onChange, type = "text", placeholder = "", maxLength, list }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; maxLength?: number; list?: string }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} list={list}
        className={CONTROL} />
    </label>
  );
}

export function Sel({ label, value, onChange, options = [] }: { label: string; value: string; onChange: (v: string) => void; options?: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <select value={value ?? ""} onChange={e => onChange(e.target.value)}
        className={CONTROL}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 py-2">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-[2px] h-5 w-5 accent-ak-red" />
      <span>
        <span className="block text-[13px] font-black text-ak-text">{label}</span>
        {hint && <span className="mt-1 block text-[11px] text-ak-text-dim">{hint}</span>}
      </span>
    </label>
  );
}

export function TextArea({ label, value, onChange, rows = 4, maxLength, placeholder = "", mono = false }: { label: string; value: string; onChange: (v: string) => void; rows?: number; maxLength?: number; placeholder?: string; mono?: boolean }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} maxLength={maxLength} placeholder={placeholder}
        className={`${mono ? CONTROL.replace("font-sans", "font-mono") : CONTROL} resize-y`} />
    </label>
  );
}

export function Segmented<T extends string>({ label, options, value, onChange, disabled = false }: {
  label:     string;
  options:   ReadonlyArray<{ value: T; label: string }>;
  value:     T;
  onChange:  (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex w-fit overflow-hidden rounded-[7px] border border-ak-border2">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={[
            "min-h-[44px] cursor-pointer border-0 px-4 font-sans text-[11px] font-black uppercase tracking-[0.1em]",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ak-red-bright",
            "disabled:cursor-not-allowed disabled:opacity-60",
            o.value === value ? "bg-ak-surface text-ak-text" : "bg-ak-base text-ak-text-dim",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ArmedButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <Btn variant="danger" onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? `TAP AGAIN TO ${label}` : label}
    </Btn>
  );
}
