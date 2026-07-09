type Props = {
  archived: boolean;
  seasonName: string;
};

export default function ArchivedBanner({ archived, seasonName }: Props) {
  if (!archived) return null;
  if (seasonName === "all-time") return null;
  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-ak-border bg-[#8b1a1a15] px-3 py-2 text-[11px] font-black tracking-[0.1em] uppercase text-ak-red-text"
    >
      🏆 {seasonName} Season Complete
    </div>
  );
}
