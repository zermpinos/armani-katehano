import { useEffect, useRef } from "react";
import { Btn } from "./primitives";

export function Confirm({ msg, onConfirm, onCancel }: { msg: string | null; onConfirm: () => void; onCancel: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!msg) return;
    const firstBtn = dialogRef.current?.querySelector<HTMLButtonElement>("button");
    firstBtn?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [msg, onCancel]);

  if (!msg) return null;
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm action"
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
    >
      <div className="bg-ak-surface p-8 rounded-xl max-w-[400px] w-[90%] border border-ak-border2">
        <p className="mb-6 text-ak-text text-[14px]">{msg}</p>
        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm}>Confirm</Btn>
        </div>
      </div>
    </div>
  );
}
