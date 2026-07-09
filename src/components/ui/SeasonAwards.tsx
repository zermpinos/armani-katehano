import Link from "next/link";
import type { Awards, PlayerRef, AwardCategory } from "@/domain/awards";
import { shortName, formatAwardValue } from "@/domain/awards";

type Props = { awards: Awards | null };

const MEDALS = ["🥇", "🥈", "🥉"] as const;

type Slot = { label: string; category: AwardCategory; players: PlayerRef[] };

function PodiumRow({ medal, category, player }: { medal: string; category: AwardCategory; player: PlayerRef }) {
  return (
    <Link
      href={`/players/${player.playerSlug}`}
      className="grid grid-cols-[auto_auto_1fr_auto] gap-1.5 items-baseline text-[12px] text-ak-text hover:text-ak-red-text"
    >
      <span aria-hidden="true">{medal}</span>
      <span className="text-ak-text-dim tabular-nums">#{player.playerNumber}</span>
      <span className="truncate">{shortName(player.playerName)}</span>
      <span className="font-semibold tabular-nums">{formatAwardValue(category, player.value)}</span>
    </Link>
  );
}

function AwardCell({ label, category, players }: Slot) {
  if (!players.length) return null;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-ak-border bg-[#8b1a1a10] px-3 py-2">
      <span className="text-[9px] font-black tracking-[0.12em] uppercase text-ak-text-dim">
        {label}
      </span>
      {players.slice(0, 3).map((p, i) => (
        <PodiumRow key={p.playerId} medal={MEDALS[i]} category={category} player={p} />
      ))}
    </div>
  );
}

export default function SeasonAwards({ awards }: Props) {
  if (!awards) return null;
  const slots: Slot[] = [
    { label: "MVP",         category: "mvp",      players: awards.mvp },
    { label: "Top Scorer",  category: "scorer",   players: awards.scorer },
    { label: "Rebounds",    category: "rebounds", players: awards.rebounds },
    { label: "Assists",     category: "assists",  players: awards.assists },
    { label: "Shooting",    category: "shooting", players: awards.shooting },
  ];
  const visible = slots.filter((s) => s.players.length > 0);
  if (!visible.length) return null;
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {visible.map((s) => (
        <AwardCell key={s.label} label={s.label} category={s.category} players={s.players} />
      ))}
    </div>
  );
}
