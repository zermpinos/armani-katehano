import { useEffect, useRef, type ReactNode } from "react";

export function BottomSheet({ open, title, onClose, children, footer, resetKey }: {
  open:      boolean;
  title:     string;
  onClose:   () => void;
  children:  ReactNode;
  footer:    ReactNode;
  resetKey?: string | number;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="sheet-title"
      // A close queued by a programmatic close() can land after a reopen, and must not shut the new sheet.
      onClose={() => { if (!ref.current?.open) onClose(); }}
      onClick={e => { if (e.target === e.currentTarget) ref.current?.close(); }}
      className="mx-0 mb-0 mt-auto w-full max-w-full max-h-[90dvh] rounded-t-2xl border border-ak-border bg-ak-surface p-0 text-ak-text backdrop:bg-black/60 md:m-auto md:max-w-[560px] md:rounded-2xl"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-ak-border px-4 py-2">
          <h2 id="sheet-title" className="text-[15px] font-black">{title}</h2>
          <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="min-h-[44px] min-w-[44px] cursor-pointer text-[22px] text-ak-text-dim">×</button>
        </div>
        <div key={`body-${resetKey}`} className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        <div key={`footer-${resetKey}`} className="border-t border-ak-border px-4 py-3">{footer}</div>
      </div>
    </dialog>
  );
}
