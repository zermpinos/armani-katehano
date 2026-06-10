import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { isStarter } from "@/domain/roster";
import { initials } from "@/domain/players/format";
import { sanitize } from "@/domain/shared/sanitize";
import { cloudinaryThumb } from "@/domain/shared/cloudinary";

type Variant = "compact" | "featured";

type PlayerSlot = {
  id:       string;
  name:     string;
  number:   number;
  position: string;
  note:     string | null;
  photoUrl?: string | null;
  slug?:     string;
};

type Announcement = {
  message: string | null;
  players: PlayerSlot[];
};

function Avatar({ p }: { p: PlayerSlot }) {
  const [broken, setBroken] = useState(false);
  const showImg = !!p.photoUrl && !broken;
  if (showImg) {
    return (
      <Image
        src={cloudinaryThumb(p.photoUrl as string, 64)}
        alt={p.name}
        width={32}
        height={32}
        onError={() => setBroken(true)}
        className="w-8 h-8 rounded-full object-cover shrink-0"
        style={{ objectPosition: "top center" }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#111111] text-white text-[11px] font-extrabold tracking-[0.04em] shrink-0"
    >
      {initials(p.name)}
    </span>
  );
}

function PlayerRow({ p, dim, withAvatar }: { p: PlayerSlot; dim?: boolean; withAvatar: boolean }) {
  const nameBase = `flex-1 text-[13px] truncate transition-colors duration-150 hover:text-ak-red-text no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ak-red rounded-sm`;
  const nameDimCls = dim ? "text-ak-text-sub font-medium" : "text-ak-text font-bold";
  return (
    <div className={`flex items-center gap-2 py-1 border-b border-ak-border last:border-b-0 ${dim ? "opacity-70" : ""}`}>
      <span className={`text-[11px] font-black min-w-[28px] [font-variant-numeric:tabular-nums] ${dim ? "text-ak-text-dim" : "text-ak-red-text"}`}>
        #{p.number}
      </span>
      {withAvatar && <Avatar p={p} />}
      <Link
        href={`/players/${p.slug ?? ""}`}
        title={p.name}
        className={`${nameBase} ${nameDimCls}`}
      >
        {p.name}
      </Link>
      <span className="hidden sm:inline text-[10px] text-ak-text-dim">{p.position}</span>
      {p.note && !isStarter(p.note) && (
        <span className="text-[9px] font-black tracking-[0.08em] px-1.5 py-0.5 rounded bg-[#4caf7d20] text-ak-green border border-[#4caf7d40] whitespace-nowrap uppercase">
          {p.note}
        </span>
      )}
    </div>
  );
}

function CoachMessage({ message, variant }: { message: string; variant: Variant }) {
  const clean = sanitize(message);
  if (!clean) return null;
  if (variant === "featured") {
    return (
      <div
        className="mt-3 py-3 px-4 rounded-r-lg"
        style={{ borderLeft: "3px solid #f59e0b", background: "rgba(245, 158, 11, 0.08)" }}
      >
        <p className="m-0 text-[9px] font-black tracking-[0.15em] uppercase" style={{ color: "#f59e0b" }}>
          Message from the coach
        </p>
        <p className="m-0 mt-1 text-[13px] text-ak-text" style={{ lineHeight: 1.55 }}>{clean}</p>
      </div>
    );
  }
  return (
    <div className="mt-[10px] py-2 px-3 rounded-lg bg-ak-surface2 text-xs text-ak-text-sub italic leading-relaxed">
      &ldquo;{clean}&rdquo;
    </div>
  );
}

export function RosterPanel({
  announcement,
  variant = "compact",
}: { announcement: Announcement; variant?: Variant }) {
  const sorted   = [...announcement.players].sort((a, b) => a.number - b.number);
  const starters = sorted.filter(p => isStarter(p.note));
  const bench    = sorted.filter(p => !isStarter(p.note));
  const split    = starters.length > 0 && bench.length > 0;
  const withAvatar = variant === "featured";

  return (
    <div className="pt-[10px]">
      {split ? (
        <>
          <div className="text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-1">
            Starters <span className="text-ak-green">· {starters.length}</span>
          </div>
          <div className="flex flex-col mb-2">
            {starters.map(p => <PlayerRow key={p.id} p={p} withAvatar={withAvatar} />)}
          </div>
          <div className="text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-1 mt-2">
            Bench <span className="text-ak-text-dim">· {bench.length}</span>
          </div>
          <div className="flex flex-col">
            {bench.map(p => <PlayerRow key={p.id} p={p} dim withAvatar={withAvatar} />)}
          </div>
        </>
      ) : (
        <>
          <div className="text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-1">
            Announced Roster
          </div>
          <div className="flex flex-col">
            {sorted.map(p => <PlayerRow key={p.id} p={p} withAvatar={withAvatar} />)}
          </div>
        </>
      )}
      {announcement.message && (
        <CoachMessage message={announcement.message} variant={variant} />
      )}
    </div>
  );
}
