import type { ReactNode } from "react";

export function ListRow({ onClick, pending = false, children, aside }: {
  onClick:  () => void;
  pending?: boolean;
  children: ReactNode;
  aside?:   ReactNode;
}) {
  return (
    <div className="flex items-stretch rounded-xl border border-ak-border bg-ak-surface">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-busy={pending || undefined}
        className="flex min-h-[56px] flex-1 cursor-pointer items-center gap-3 px-4 py-3 text-left disabled:cursor-wait disabled:opacity-60"
      >
        <div className="min-w-0 flex-1">{children}</div>
        {pending
          ? <span className="text-[11px] font-black uppercase tracking-[0.12em] text-ak-text-dim">Saving...</span>
          : <span aria-hidden="true" className="text-[18px] text-ak-text-dim">›</span>}
      </button>
      {aside && <div className="flex items-center pr-3">{aside}</div>}
    </div>
  );
}

export function ShowAllToggle({ showAll, onToggle, hiddenCount, hiddenLabel }: {
  showAll:     boolean;
  onToggle:    () => void;
  hiddenCount: number;
  hiddenLabel: string;
}) {
  if (!showAll && hiddenCount === 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="min-h-[44px] cursor-pointer text-[12px] font-black uppercase tracking-[0.1em] text-ak-red-text"
    >
      {showAll ? "Show current only" : `Show all (${hiddenCount} ${hiddenLabel})`}
    </button>
  );
}
