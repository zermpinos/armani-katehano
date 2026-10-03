import { useState } from "react";
import { F, Sel, Btn } from "@/client/admin/primitives";
import { apiFetch } from "@/client/admin/csrf";
import type { Player } from "@/client/admin/shared";
import { POSITIONS } from "@/domain/players/positions";
import type { ResolvedRow } from "@/domain/import/resolve";
import { eligiblePlayers, type LineEntry } from "@/client/admin/import/line-assign";

const POSITION_OPTIONS = POSITIONS.map(p => ({ value: p, label: p }));

type Props = {
  entries:   LineEntry[];
  players:   Player[];
  box:       ResolvedRow[];
  disabled:  boolean;
  onAssign:  (entry: LineEntry, to: string | null) => void;
  onCreated: (player: Player) => void;
};

export function LineAssignments({ entries, players, box, disabled, onAssign, onCreated }: Props) {
  if (!entries.length) return null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[#8b1a1a] bg-[#8b1a1a30] px-[14px] py-[10px]">
      <div className="text-xs font-black text-ak-red-text">Check who played these lines before saving:</div>
      {entries.map(entry => {
        const owner = players.find(p => p.id === entry.ownerId);
        const note = entry.ownerId
          ? `#${entry.number} on the sheet is ${entry.scrapedName}, but #${entry.number} on the roster is ${owner?.name ?? "someone else"}.`
          : `#${entry.number} ${entry.scrapedName} played but is not on the roster.`;
        const choices = [
          ...(entry.ownerId ? [] : [{ value: "", label: "Nobody yet" }]),
          ...eligiblePlayers(players, box, entry).map(p => ({ value: p.id, label: `#${p.number} ${p.name}` })),
        ];
        return (
          <div key={`${entry.number}-${entry.ownerId ?? "new"}`} className="flex flex-col gap-2">
            <div className="text-xs text-ak-red-text">{note}</div>
            <Sel label={`PLAYER FOR #${entry.number}`} value={entry.assignee ?? ""} onChange={v => onAssign(entry, v || null)} options={choices} />
            {entry.ownerId === null && entry.assignee === null && (
              <AddToRoster number={entry.number} scrapedName={entry.scrapedName} disabled={disabled} onCreated={onCreated} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AddToRoster({ number, scrapedName, disabled, onCreated }: {
  number:      number;
  scrapedName: string;
  disabled:    boolean;
  onCreated:   (player: Player) => void;
}) {
  const [name,     setName]     = useState(scrapedName);
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
        body:    JSON.stringify({ name: name.trim(), number, position }),
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
      <div className="flex flex-wrap items-end gap-[10px]">
        <div className="min-w-[150px] flex-1"><F label="NAME" value={name} onChange={setName} /></div>
        <div className="w-[110px]"><Sel label="POSITION" value={position} onChange={setPosition} options={POSITION_OPTIONS} /></div>
        <Btn onClick={add} size="sm" disabled={disabled || busy || !name.trim()}>
          {busy ? "ADDING..." : "ADD TO ROSTER"}
        </Btn>
      </div>
      {error && <div className="text-[11px] text-ak-red-text">{error}</div>}
    </div>
  );
}
