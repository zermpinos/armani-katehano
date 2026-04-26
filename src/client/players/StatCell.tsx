export function StatCell({ label, value, highlight = false }: any) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-[10px] py-[10px] px-1 border",
        highlight
          ? "border-[#c0392b45] bg-[#8b1a1a20]"
          : "border-ak-border bg-ak-surface2",
      ].join(" ")}
    >
      <div className="text-[10px] font-black tracking-[0.12em] text-ak-text-dim">{label}</div>
      <div className={["text-[16px] font-black mt-0.5", highlight ? "text-ak-red-text" : "text-ak-text"].join(" ")}>
        {value}
      </div>
    </div>
  );
}
