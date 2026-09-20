import Link from "next/link";
import { fmtDate } from "@/domain/shared/format";
import type { PlayerRecord } from "@/domain/stats/records";

type Row = PlayerRecord & { playerName: string; home?: boolean };

export function PlayerRecordRows({ records }: { records: Row[] }) {
  if (!records.length) return null;

  return (
    <>
      <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-3 uppercase">
        Single Game Records
      </div>
      <div className="grid gap-[5px] lg:grid-cols-2 mb-8">
        {records.map(r => (
          <Link
            key={r.key}
            href={`/games/${r.gameId}`}
            aria-label={`${r.label} record, ${r.value} by ${r.playerName} against ${r.opponent} on ${fmtDate(r.date)}, open the box score`}
            className="flex items-center gap-3 py-[10px] px-[14px] rounded-[10px] border border-ak-border bg-transparent no-underline transition-colors duration-150 hover:bg-ak-surface2"
          >
            <span className="text-[10px] font-black tracking-[0.12em] text-ak-text-dim w-9 shrink-0">{r.label}</span>
            <span className="text-[18px] font-black text-ak-text w-10 shrink-0">{r.value}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-bold text-ak-text truncate">{r.playerName}</span>
              <span className="block text-[11px] text-ak-text-dim truncate">
                {r.home ? "vs" : "@"} {r.opponent} · {fmtDate(r.date)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
