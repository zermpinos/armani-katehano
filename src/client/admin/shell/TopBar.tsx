type Props = {
  title:       string;
  onOpenMenu:  () => void;
};

export function TopBar({ title, onOpenMenu }: Props) {
  return (
    <header className="lg:hidden sticky top-0 z-30 bg-ak-surface border-b border-ak-border">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="p-2 -ml-2 text-ak-text-dim cursor-pointer"
        >
          <div className="flex flex-col gap-[4px] w-[18px]">
            <span className="block h-[2px] bg-current rounded-full" />
            <span className="block h-[2px] bg-current rounded-full" />
            <span className="block h-[2px] bg-current rounded-full" />
          </div>
        </button>
        <div className="text-[11px] font-black tracking-[0.12em] uppercase text-ak-text truncate">
          {title}
        </div>
      </div>
    </header>
  );
}
