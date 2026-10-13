import { F } from "@/client/admin/primitives";
import type { Player } from "@/client/admin/shared";
import type { ResolvedRow } from "@/domain/import/resolve";
import { fmt } from "@/domain/players/format";

// FGM and FGA are left out because the save recomputes them from the splits, and EFF because it is never stored.
const FIELDS = [
  ["min", "MIN"], ["pts", "PTS"], ["reb", "REB"], ["orb", "ORB"],
  ["drb", "DRB"], ["ast", "AST"], ["stl", "STL"], ["blk", "BLK"],
  ["tov", "TOV"], ["pf", "PF"], ["fg2m", "2PM"], ["fg2a", "2PA"],
  ["fg3m", "3PM"], ["fg3a", "3PA"], ["ftm", "FTM"], ["fta", "FTA"],
] as const;

type Props = {
  players:  Player[];
  rows:     ResolvedRow[];
  playedIds: Set<string>;
  onUpdate: (playerId: string, key: string, value: string) => void;
};

export function ReviewCards({ players, rows, playedIds, onUpdate }: Props) {
  const byId   = new Map(players.map(p => [p.id, p]));
  const sorted = [...rows].sort((a, b) => Number(byId.get(a.playerId)?.number) - Number(byId.get(b.playerId)?.number));
  // Not live MIN: a card crossing 0 mid-typing would switch lists, remount and drop the keystroke.
  const played = sorted.filter(r => playedIds.has(r.playerId));
  const bench  = sorted.filter(r => !playedIds.has(r.playerId));
  const card = (r: ResolvedRow) => <PlayerCard key={r.playerId} player={byId.get(r.playerId)} row={r} onUpdate={onUpdate} />;

  return (
    <div className="flex flex-col gap-2">
      {played.map(card)}
      {bench.length > 0 && (
        <details className="rounded-lg border border-dashed border-ak-border">
          <summary className="flex min-h-[44px] cursor-pointer items-center px-3 text-[12px] font-black uppercase tracking-[0.1em] text-ak-text-dim">
            {`Didn't play (${bench.length})`}
          </summary>
          <div className="flex flex-col gap-2 p-2">{bench.map(card)}</div>
        </details>
      )}
    </div>
  );
}

function PlayerCard({ player, row, onUpdate }: { player: Player | undefined; row: ResolvedRow; onUpdate: Props["onUpdate"] }) {
  return (
    <details className="rounded-lg border border-ak-border bg-ak-surface2">
      <summary className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2">
        <span className="w-[32px] shrink-0 text-[13px] font-black text-ak-text-dim">#{player?.number ?? "?"}</span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-black text-ak-text">{player ? fmt(player.name) : "Unknown player"}</span>
        <span className="shrink-0 text-[12px] text-ak-text-sub">{`${row.pts} PTS · ${row.reb} REB · ${row.ast} AST`}</span>
      </summary>
      <div className="grid grid-cols-4 gap-2 border-t border-ak-border p-3">
        {FIELDS.map(([key, label]) => (
          <F key={key} label={label} type="number" value={Reflect.get(row, key) as number} onChange={v => onUpdate(row.playerId, key, v)} />
        ))}
      </div>
    </details>
  );
}
