import { useState } from "react";
import { BottomSheet } from "@/client/admin/bottom-sheet";
import { F, Sel, Btn } from "@/client/admin/primitives";
import type { ScheduleDraft } from "./schedule-draft";

export function ScheduleSheet({ open, resetKey, isNew, draft, error, onChange, onSave, onClose, onDelete }: {
  open:      boolean;
  resetKey?: string | number;
  isNew:     boolean;
  draft:     ScheduleDraft;
  error:     string | null;
  onChange:  (d: ScheduleDraft) => void;
  onSave:    () => void;
  onClose:   () => void;
  onDelete?: () => void;
}) {
  const upd = <K extends keyof ScheduleDraft>(k: K, v: ScheduleDraft[K]) => onChange({ ...draft, [k]: v });

  return (
    <BottomSheet
      open={open}
      resetKey={resetKey}
      title={isNew ? "Schedule game" : "Edit fixture"}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Btn onClick={onSave}>{isNew ? "SAVE" : "SAVE CHANGES"}</Btn>
            <Btn variant="ghost" onClick={onClose}>CANCEL</Btn>
          </div>
          {onDelete && <DeleteButton onDelete={onDelete} />}
        </div>
      }
    >
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-[#8b1a1a55] bg-[#8b1a1a22] px-3 py-2 text-[13px] font-bold text-ak-red-text">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-4">
        <F label="OPPONENT" value={draft.opponent} onChange={v => upd("opponent", v)} />
        <Sel
          label="HOME / AWAY"
          value={draft.location}
          onChange={v => upd("location", v as ScheduleDraft["location"])}
          options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]}
        />
        <div className="grid grid-cols-2 gap-3">
          <F label="DATE" type="date" value={draft.date} onChange={v => upd("date", v)} />
          <F label="TIME" type="time" value={draft.time} onChange={v => upd("time", v)} />
        </div>
        <F label="SOURCE URL" value={draft.sourceUrl} onChange={v => upd("sourceUrl", v)} placeholder="https://basketcity.sportstats.gr/.../gamedetails/..." />
        <details open={Boolean(draft.competition || draft.notes)} className="rounded-lg border border-ak-border px-3 py-2">
          <summary className="min-h-[44px] cursor-pointer py-3 text-[12px] font-black uppercase tracking-[0.12em] text-ak-text-dim">More details</summary>
          <div className="flex flex-col gap-4 pb-2">
            <F label="COMPETITION" value={draft.competition} onChange={v => upd("competition", v)} placeholder="e.g. Super Winter Cup" />
            <F label="NOTES" value={draft.notes} onChange={v => upd("notes", v)} placeholder="Optional notes" />
          </div>
        </details>
      </div>
    </BottomSheet>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <Btn variant="danger" onClick={() => (armed ? onDelete() : setArmed(true))}>
      {armed ? "TAP AGAIN TO DELETE" : "DELETE"}
    </Btn>
  );
}
