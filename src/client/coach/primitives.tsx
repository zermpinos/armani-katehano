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

export function Spinner() {
  return (
    <div className="w-8 h-8 rounded-full border-2 border-ak-border2 border-t-ak-red-bright animate-ak-spin" />
  );
}

export function Btn({ onClick, disabled = false, children, variant = "primary", size = "md" }: any) {
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
