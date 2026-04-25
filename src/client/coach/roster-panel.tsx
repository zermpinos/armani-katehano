import { Spinner, Btn } from "./primitives";

interface Props {
  allPlayers: any[];
  rosterSlots: Record<string, { checked: boolean; note: string }>;
  rosterMsg: string;
  onRosterMsgChange: (msg: string) => void;
  panelLoading: boolean;
  saving: boolean;
  selectedCount: number;
  isAnnounced: boolean;
  onTogglePlayer: (pid: string) => void;
  onSetNote: (pid: string, note: string) => void;
  onPublish: () => void;
  onResendEmail: () => void;
  onRemoveAnnouncement: () => void;
  onClose: () => void;
}

export function CoachRosterPanel({
  allPlayers, rosterSlots, rosterMsg, onRosterMsgChange,
  panelLoading, saving, selectedCount, isAnnounced,
  onTogglePlayer, onSetNote, onPublish, onResendEmail, onRemoveAnnouncement, onClose,
}: Props) {
  return (
    <div className="mt-1 rounded-[10px] border border-[#4caf7d40] p-5 bg-ak-base">
      {panelLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <>
          {/* Player selection */}
          <div className="mb-5">
            <div className="text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[10px]">
              Players &nbsp;
              <span className={selectedCount > 0 ? "text-ak-green font-bold" : "text-ak-text-dim font-bold"}>
                ({selectedCount} selected)
              </span>
            </div>

            {allPlayers.length === 0 ? (
              <div className="text-xs text-ak-text-dim">No active players found.</div>
            ) : (
              <div className="flex flex-col gap-1">
                {allPlayers.map((p: any) => {
                  const slot = rosterSlots[p.id] ?? { checked: false, note: "" };
                  return (
                    <div key={p.id} className={[
                      "flex items-center gap-[10px] py-[7px] px-3 rounded-lg border transition-[background,border-color] duration-100",
                      slot.checked ? "bg-[#4caf7d12] border-[#4caf7d40]" : "bg-ak-surface2 border-ak-border",
                    ].join(" ")}>
                      <input
                        type="checkbox"
                        checked={slot.checked}
                        onChange={() => onTogglePlayer(p.id)}
                        className="w-4 h-4 shrink-0 cursor-pointer accent-ak-green"
                      />
                      <span className={["text-xs font-black min-w-[30px] tabular-nums", slot.checked ? "text-ak-green" : "text-ak-text-dim"].join(" ")}>#{p.number}</span>
                      <span className={["text-[13px] flex-1", slot.checked ? "text-ak-text font-bold" : "text-ak-text-sub font-normal"].join(" ")}>{p.name}</span>
                      <span className="text-[10px] text-ak-text-dim min-w-[36px]">{p.position}</span>
                      {slot.checked && (
                        <input
                          type="text"
                          value={slot.note}
                          onChange={e => onSetNote(p.id, e.target.value)}
                          placeholder="note (e.g. starting)"
                          maxLength={200}
                          className="w-[170px] py-[3px] px-2 text-[11px] rounded-[5px] border border-ak-border2 bg-ak-surface text-ak-text font-sans outline-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coach message */}
          <div className="mb-5">
            <label className="block">
              <span className="block text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[6px]">
                Coach message <span className="font-normal normal-case tracking-normal">(optional)</span>
              </span>
              <textarea
                value={rosterMsg}
                onChange={e => onRosterMsgChange(e.target.value)}
                placeholder="Add a message for fans..."
                maxLength={1000}
                rows={3}
                className="w-full py-2 px-3 text-[13px] rounded-lg border border-ak-border2 bg-ak-surface text-ak-text font-sans outline-none resize-y"
              />
              <span className="text-[10px] text-ak-text-dim">{rosterMsg.length} / 1000</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-[10px] flex-wrap items-center">
            <Btn onClick={onPublish} disabled={saving} variant="green">
              {saving ? "SAVING..." : isAnnounced ? "UPDATE ROSTER" : "PUBLISH ROSTER"}
            </Btn>
            {isAnnounced && (
              <Btn onClick={onResendEmail} disabled={saving} variant="ghost">
                RESEND EMAIL
              </Btn>
            )}
            {isAnnounced && (
              <Btn onClick={onRemoveAnnouncement} disabled={saving} variant="danger">
                REMOVE
              </Btn>
            )}
            <Btn variant="ghost" onClick={onClose}>CANCEL</Btn>
          </div>
        </>
      )}
    </div>
  );
}
