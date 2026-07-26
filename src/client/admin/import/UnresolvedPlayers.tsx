import { useState } from "react";
import { F, Sel, Btn, apiFetch } from "@/client/admin";
import type { Player } from "@/client/admin";
import { POSITIONS } from "@/domain/players/positions";
import type { UnresolvedPlayer } from "@/domain/import/resolve";

const POSITION_OPTIONS = POSITIONS.map(p => ({ value: p, label: p }));

type Props = {
  entries: UnresolvedPlayer[];
  disabled: boolean;
  onCreated: (player: Player) => void;
};

export function UnresolvedPlayers({ entries, disabled, onCreated }: Props) {
  if (!entries.length) return null;

  return (
    <div className="py-[10px] px-[14px] rounded-lg bg-[#8b1a1a30] border border-[#8b1a1a] flex flex-col gap-3">
      <div className="text-xs font-black text-ak-red-text">
        Played but not on the roster - add them, or their stats are dropped:
      </div>
      {entries.map(e => (
        <Row key={e.number} entry={e} disabled={disabled} onCreated={onCreated} />
      ))}
    </div>
  );
}

function Row({ entry, disabled, onCreated }: { entry: UnresolvedPlayer } & Omit<Props, "entries">) {
  const [name,     setName]     = useState(entry.name);
  const [position, setPosition] = useState(POSITIONS[0]);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState("");

  const add = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin/players", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim(), number: entry.number, position }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Could not add player");
        return;
      }
      onCreated(body.player);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-[10px] items-end flex-wrap">
        <div className="text-[18px] font-black text-ak-text shrink-0 pb-[6px] w-[38px]">#{entry.number}</div>
        <div className="flex-1 min-w-[150px]"><F label="NAME" value={name} onChange={setName} /></div>
        <div className="w-[110px]"><Sel label="POSITION" value={position} onChange={setPosition} options={POSITION_OPTIONS} /></div>
        <Btn onClick={add} size="sm" disabled={disabled || busy || !name.trim()}>
          {busy ? "ADDING..." : "ADD TO ROSTER"}
        </Btn>
      </div>
      {error && <div className="text-[11px] text-ak-red-text">{error}</div>}
    </div>
  );
}
