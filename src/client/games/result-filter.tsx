export function ResultFilter({ selected, onChange }: any) {
  const options = [
    { value: "all", label: "All" },
    { value: "W",   label: "Wins" },
    { value: "L",   label: "Losses" },
  ];
  return (
    <div className="flex gap-1.5 flex-wrap mb-5">
      {options.map(o => {
        const active = o.value === selected;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`py-[5px] px-[14px] text-[11px] font-black tracking-[0.12em] uppercase rounded-lg border cursor-pointer transition-all duration-150 ${
              active
                ? o.value === "W"
                  ? "border-ak-green bg-[#4caf7d25] text-ak-green"
                  : o.value === "L"
                    ? "border-ak-red-text bg-[#8b1a1a30] text-ak-red-text"
                    : "border-ak-red bg-ak-red text-ak-text"
                : "border-ak-border bg-transparent text-ak-text-dim"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
