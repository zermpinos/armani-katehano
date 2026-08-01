import Link from "next/link";
import type { Awards, PlayerRef, AwardCategory } from "@/domain/awards";
import { shortName, formatAwardValue } from "@/domain/awards";
import { TooltipHint, TS_PCT_EXPLANATION } from "@/components/ui";

type Props = { awards: Awards | null };

const MEDALS = ["🥇", "🥈", "🥉"] as const;

type Slot = { label: string; category: AwardCategory; players: PlayerRef[]; tooltip?: string };

function AwardLabel({ label, tooltip }: { label: string; tooltip?: string }) {
  const labelEl = (
    <span
      className={`text-[9px] font-black tracking-[0.12em] uppercase text-ak-text-dim ${tooltip ? "underline decoration-dotted cursor-help" : ""}`}
    >
      {label}
    </span>
  );
  return tooltip ? <TooltipHint text={tooltip}>{labelEl}</TooltipHint> : labelEl;
}

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

function AwardCell({ label, category, players, tooltip }: Slot) {
  if (!players.length) return null;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-ak-border bg-[#8b1a1a10] px-3 py-2">
      <AwardLabel label={label} tooltip={tooltip} />
      {players.slice(0, 3).map((p, i) => (
        <PodiumRow key={p.playerId} medal={Reflect.get(MEDALS, i) as string} category={category} player={p} />
      ))}
    </div>
  );
}

export default function SeasonAwards({ awards }: Props) {
  if (!awards) return null;
  const slots: Slot[] = [
    { label: "MVP",        category: "mvp",      players: awards.mvp },
    { label: "Top Scorer", category: "scorer",   players: awards.scorer },
    { label: "Rebounds",   category: "rebounds", players: awards.rebounds },
    { label: "Assists",    category: "assists",  players: awards.assists },
    {
      label:    "TS%",
      category: "shooting",
      players:  awards.shooting,
      tooltip:  TS_PCT_EXPLANATION,
    },
  ];
  const visible = slots.filter((s) => s.players.length > 0);
  if (!visible.length) return null;
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {visible.map((s) => (
        <AwardCell key={s.label} label={s.label} category={s.category} players={s.players} tooltip={s.tooltip} />
      ))}
    </div>
  );
}
