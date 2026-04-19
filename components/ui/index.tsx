import React, { useEffect } from "react";

// ── Player silhouette SVG ────────────────────────────────────────────────────

interface PlayerSilhouetteProps {
  style?: React.CSSProperties;
}

export function PlayerSilhouette({ style = {} }: PlayerSilhouetteProps) {
  return (
    <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
      <circle cx="50" cy="28" r="18" fill="currentColor" opacity="0.55" />
      <path d="M18 115 C18 85 28 70 50 68 C72 70 82 85 82 115Z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

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

// ── Primary / ghost / danger / secondary button ───────────────────────────────

interface BtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "secondary";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

const BTN_VARIANT: Record<string, string> = {
  primary:   "bg-ak-red border-transparent text-ak-text",
  danger:    "bg-[#7f1d1d] border-transparent text-ak-text",
  ghost:     "bg-transparent border-ak-border2 text-ak-text-sub",
  secondary: "bg-ak-surface2 border-transparent text-ak-text",
};

const BTN_SIZE: Record<string, string> = {
  sm: "py-[6px] px-3 text-[11px]",
  md: "py-[9px] px-[18px] text-[13px]",
};

export function Btn({ children, onClick, variant = "primary", size = "md", disabled = false, type = "button" }: BtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        "font-black tracking-[0.12em] rounded-lg border font-sans transition-opacity duration-150",
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer opacity-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ── Inline text field ─────────────────────────────────────────────────────────

interface FieldProps {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  small?: boolean;
}

export function Field({ label, value, onChange, type = "text", placeholder = "", small = false }: FieldProps) {
  return (
    <div>
      {label && (
        <label className="block text-[10px] font-black tracking-[0.15em] mb-1.5 text-ak-text-dim uppercase">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          "w-full rounded-lg border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none",
          small ? "py-[6px] px-2 text-xs" : "py-[9px] px-3 text-[13px]",
        ].join(" ")}
      />
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}

export function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <div>
      {label && (
        <label className="block text-[10px] font-black tracking-[0.15em] mb-1.5 text-ak-text-dim uppercase">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full py-[9px] px-3 text-[13px] rounded-lg border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onDone: () => void;
}

export function Toast({ message, type = "success", onDone }: ToastProps) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return (
    <div
      className={[
        "fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 rounded-xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
        "bg-ak-surface2 text-ak-text text-[14px] font-semibold border",
        type === "success" ? "border-[#4caf7d60]" : "border-[#e0555560]",
      ].join(" ")}
    >
      <span>{type === "success" ? "✓" : "✕"}</span>
      <span>{message}</span>
    </div>
  );
}

// ── Confirmation dialog ───────────────────────────────────────────────────────

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75">
      <div className="bg-ak-surface border border-ak-border2 rounded-2xl p-6 w-full max-w-[360px] shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
        <div className="text-[17px] font-black text-ak-text mb-2">Are you sure?</div>
        <div className="text-[13px] text-ak-text-sub mb-6">{message}</div>
        <div className="flex gap-2.5 justify-end">
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm}>Delete</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────

interface SpinnerProps {
  size?: number;
}

export function Spinner({ size = 32 }: SpinnerProps) {
  // size is a runtime value in px — set via CSS variable, consumed by arbitrary Tailwind class
  return (
    <div
      className="rounded-full border-2 border-ak-border2 border-t-ak-red-bright animate-ak-spin"
      style={{ width: size, height: size }}
    />
  );
}
