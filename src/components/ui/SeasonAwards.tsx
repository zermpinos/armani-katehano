import Link from "next/link";
import type { Awards, PlayerRef } from "@/domain/awards";

type Props = { awards: Awards | null };

type Slot = { label: string; player: PlayerRef | null };

function AwardCell({ label, player }: Slot) {
  if (!player) return null;
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-ak-border bg-[#8b1a1a10] px-3 py-2">
      <span className="text-[9px] font-black tracking-[0.12em] uppercase text-ak-text-dim">
        {label}
      </span>
      <Link
        href={`/players/${player.playerSlug}`}
        className="text-[12px] font-semibold text-ak-text hover:text-ak-red-text"
      >
        #{player.playerNumber} {player.playerName}
      </Link>
    </div>
  );
}

export default function SeasonAwards({ awards }: Props) {
  if (!awards) return null;
  const slots: Slot[] = [
    { label: "MVP", player: awards.mvp },
    { label: "Top Scorer", player: awards.scorer },
    { label: "Rebounds", player: awards.rebounds },
    { label: "Assists", player: awards.assists },
    { label: "Shooting", player: awards.shooting },
  ];
  const visible = slots.filter((s) => s.player);
  if (!visible.length) return null;
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {visible.map((s) => (
        <AwardCell key={s.label} label={s.label} player={s.player} />
      ))}
    </div>
  );
}
