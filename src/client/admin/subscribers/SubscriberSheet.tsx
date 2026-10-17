import type { ReactNode } from "react";
import { BottomSheet } from "@/client/admin/bottom-sheet";
import { Btn, ArmedButton } from "@/client/admin/primitives";
import { fmtDate } from "@/domain/shared/format";
import { isConfirmed, type SubscriberRow } from "./subscriber-list";

export function SubscriberSheet({ open, resetKey, row, error, onRemove, onClose }: {
  open:      boolean;
  resetKey?: number;
  row:       SubscriberRow | null;
  error:     string | null;
  onRemove:  () => void;
  onClose:   () => void;
}) {
  return (
    <BottomSheet
      open={open}
      resetKey={resetKey}
      title="Subscriber"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Btn variant="ghost" onClick={onClose}>CLOSE</Btn>
          {row && <ArmedButton label="REMOVE" onConfirm={onRemove} />}
        </div>
      }
    >
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-[#8b1a1a55] bg-[#8b1a1a22] px-3 py-2 text-[13px] font-bold text-ak-red-text">
          {error}
        </div>
      )}
      {row && (
        <>
          <dl className="flex flex-col gap-4">
            <Item label="Email"><span className="break-all font-mono">{row.email}</span></Item>
            <Item label="Status">{isConfirmed(row) ? "Confirmed" : "Pending"}</Item>
            <Item label="Joined">{fmtDate(row.createdAt)}</Item>
            <Item label="Confirmed">{row.confirmedAt ? fmtDate(row.confirmedAt) : "Not yet"}</Item>
          </dl>
          <p className="mt-5 text-[12px] text-ak-text-dim">Remove deletes this address for good. They can sign up again from the site.</p>
        </>
      )}
    </BottomSheet>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-ak-text-dim">{label}</dt>
      <dd className="mt-1 text-[15px] text-ak-text">{children}</dd>
    </div>
  );
}
