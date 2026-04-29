function isStarter(note: string | null | undefined): boolean {
  if (!note) return false;
  return /^start(er|ing)?$/i.test(note.trim());
}

function PlayerRow({ p, onPlayerClick, dim }: { p: any; onPlayerClick?: (id: string) => void; dim?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1 border-b border-ak-border last:border-b-0">
      <span className={`text-[11px] font-black min-w-[28px] [font-variant-numeric:tabular-nums] ${dim ? "text-ak-text-dim" : "text-ak-red-text"}`}>
        #{p.number}
      </span>
      <button
        type="button"
        onClick={() => onPlayerClick?.(p.id)}
        disabled={!onPlayerClick}
        className={`flex-1 text-left bg-transparent border-0 p-0 text-[13px] transition-colors duration-150 ${dim ? "text-ak-text-sub font-normal" : "text-ak-text font-bold"} ${onPlayerClick ? "cursor-pointer hover:text-ak-red-text" : "cursor-default"}`}
      >
        {p.name}
      </button>
      <span className="text-[10px] text-ak-text-dim">{p.position}</span>
      {p.note && !isStarter(p.note) && (
        <span className="text-[9px] font-black tracking-[0.08em] px-1.5 py-0.5 rounded bg-[#4caf7d20] text-ak-green border border-[#4caf7d40] whitespace-nowrap">
          {p.note}
        </span>
      )}
    </div>
  );
}

export function RosterPanel({ announcement, onPlayerClick }: { announcement: any; onPlayerClick?: (id: string) => void }) {
  const sorted   = [...announcement.players].sort((a: any, b: any) => a.number - b.number);
  const starters = sorted.filter((p: any) => isStarter(p.note));
  const bench    = sorted.filter((p: any) => !isStarter(p.note));
  const split    = starters.length > 0 && bench.length > 0;

  return (
    <div className="pt-[10px]">
      {split ? (
        <>
          <div className="text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-1">
            Starters <span className="text-ak-green">· {starters.length}</span>
          </div>
          <div className="flex flex-col mb-2">
            {starters.map((p: any) => <PlayerRow key={p.id} p={p} onPlayerClick={onPlayerClick} />)}
          </div>
          <div className="text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-1 mt-2">
            Bench <span className="text-ak-text-dim">· {bench.length}</span>
          </div>
          <div className="flex flex-col">
            {bench.map((p: any) => <PlayerRow key={p.id} p={p} onPlayerClick={onPlayerClick} dim />)}
          </div>
        </>
      ) : (
        <>
          <div className="text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-1">
            Announced Roster
          </div>
          <div className="flex flex-col">
            {sorted.map((p: any) => <PlayerRow key={p.id} p={p} onPlayerClick={onPlayerClick} />)}
          </div>
        </>
      )}
      {announcement.message && (
        <div className="mt-[10px] py-2 px-3 rounded-lg bg-ak-surface2 text-xs text-ak-text-sub italic leading-relaxed">
          &ldquo;{announcement.message}&rdquo;
        </div>
      )}
    </div>
  );
}
