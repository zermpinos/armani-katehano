export function RosterPanel({ announcement, onPlayerClick }: { announcement: any; onPlayerClick?: (id: string) => void }) {
  return (
    <div className="pt-[10px]">
      <div className="text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-2">
        Announced Roster
      </div>
      <div className="flex flex-col gap-0.5">
        {announcement.players.map((p: any) => (
          <div key={p.id} className="flex items-center gap-2 py-1 border-b border-ak-border">
            <span className="text-[11px] font-black text-ak-text-dim min-w-[28px] [font-variant-numeric:tabular-nums]">#{p.number}</span>
            <button
              type="button"
              onClick={() => onPlayerClick?.(p.id)}
              disabled={!onPlayerClick}
              className={`flex-1 text-left bg-transparent border-0 p-0 text-[13px] text-ak-text transition-colors duration-150 ${onPlayerClick ? "cursor-pointer hover:text-ak-red-text" : "cursor-default"}`}
            >
              {p.name}
            </button>
            <span className="text-[10px] text-ak-text-dim">{p.position}</span>
            {p.note && (
              <span className="text-[9px] font-black tracking-[0.08em] px-1.5 py-0.5 rounded bg-[#4caf7d20] text-ak-green border border-[#4caf7d40] whitespace-nowrap">
                {p.note}
              </span>
            )}
          </div>
        ))}
      </div>
      {announcement.message && (
        <div className="mt-[10px] py-2 px-3 rounded-lg bg-ak-surface2 text-xs text-ak-text-sub italic leading-relaxed">
          &ldquo;{announcement.message}&rdquo;
        </div>
      )}
    </div>
  );
}
