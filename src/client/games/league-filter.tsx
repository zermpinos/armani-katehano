export function LeagueFilter({ leagues, selected, onChange }: any) {
  if (leagues.length <= 1) return null;
  const options = [{ slug: "all", name: "All" }, ...leagues];
  return (
    <div className="flex gap-1.5 flex-wrap mb-5">
      {options.map((l: any) => {
        const active = l.slug === selected;
        return (
          <button
            key={l.slug}
            onClick={() => onChange(l.slug)}
            className={`py-[5px] px-[14px] text-[11px] font-black tracking-[0.12em] uppercase rounded-lg border cursor-pointer transition-all duration-150 ${
              active ? "border-ak-red bg-ak-red text-ak-text" : "border-ak-border bg-transparent text-ak-text-dim"
            }`}
          >
            {l.name}
          </button>
        );
      })}
    </div>
  );
}
