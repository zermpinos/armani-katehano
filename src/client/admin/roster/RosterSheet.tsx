import Image from "next/image";
import { useState } from "react";
import { BottomSheet } from "@/client/admin/bottom-sheet";
import { F, Sel, Btn, Check } from "@/client/admin/primitives";
import { POSITIONS } from "@/domain/players/positions";
import { initials } from "@/domain/players/format";
import { cloudinaryThumb } from "@/domain/shared/cloudinary";
import type { LeagueJersey, PlayerDraft } from "./player-draft";

const POSITION_OPTIONS = POSITIONS.map(p => ({ value: p, label: p }));

export function RosterSheet({ open, isNew, draft, leagues, error, onChange, onLeaguesChange, onSave, onClose }: {
  open:            boolean;
  isNew:           boolean;
  draft:           PlayerDraft;
  leagues:         LeagueJersey[] | null;
  error:           string | null;
  onChange:        (d: PlayerDraft) => void;
  onLeaguesChange: (l: LeagueJersey[]) => void;
  onSave:          () => void;
  onClose:         () => void;
}) {
  const upd = <K extends keyof PlayerDraft>(k: K, v: PlayerDraft[K]) => onChange({ ...draft, [k]: v });

  return (
    <BottomSheet
      open={open}
      title={isNew ? "Add player" : "Edit player"}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Btn onClick={onSave}>{isNew ? "ADD PLAYER" : "SAVE CHANGES"}</Btn>
          <Btn variant="ghost" onClick={onClose}>CANCEL</Btn>
        </div>
      }
    >
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-[#8b1a1a55] bg-[#8b1a1a22] px-3 py-2 text-[13px] font-bold text-ak-red-text">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-4">
        <F label="FULL NAME" value={draft.name} onChange={v => upd("name", v)} />
        <div className="grid grid-cols-2 gap-3">
          <F label="JERSEY #" type="number" value={draft.number} onChange={v => upd("number", v)} />
          <Sel label="POSITION" value={draft.position} onChange={v => upd("position", v)} options={POSITION_OPTIONS} />
        </div>
        {!isNew && (
          <Check
            label="Active"
            checked={draft.isActive}
            onChange={v => upd("isActive", v)}
            hint="Retired players keep their game stats and leave the active roster."
          />
        )}
        <details className="rounded-lg border border-ak-border px-3 py-2">
          <summary className="min-h-[44px] cursor-pointer py-3 text-[12px] font-black uppercase tracking-[0.12em] text-ak-text-dim">More details</summary>
          <div className="flex flex-col gap-4 pb-2">
            <div className="flex items-center gap-4">
              <AvatarPreview name={draft.name || "?"} photoUrl={draft.photoUrl} />
              <div className="text-[12px] leading-relaxed text-ak-text-dim">Cloudinary URLs are auto-thumbnailed. Other URLs are loaded as-is.</div>
            </div>
            <F label="PHOTO URL" value={draft.photoUrl} onChange={v => upd("photoUrl", v)} placeholder="https://res.cloudinary.com/..." />
            <div className="grid grid-cols-2 gap-3">
              <F label="HEIGHT" value={draft.height} onChange={v => upd("height", v)} placeholder={`e.g. 6'4"`} />
              <F label="WEIGHT" value={draft.weight} onChange={v => upd("weight", v)} placeholder="e.g. 90 kg" />
            </div>
            <F label="CONTACT EMAIL" type="email" value={draft.contactEmail} onChange={v => upd("contactEmail", v)} placeholder="player@example.com" />
            {!isNew && leagues === null && <div className="text-[12px] text-ak-text-dim">Loading competitions...</div>}
            {!isNew && leagues !== null && leagues.length > 0 && (
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.15em] text-ak-text-dim">Per-competition jersey</div>
                <div className="mb-3 mt-1 text-[12px] leading-relaxed text-ak-text-dim">
                  Blank wears the number above. Set one only where a competition registered this player under a different number.
                </div>
                <div className="flex flex-col gap-3">
                  {leagues.map((l, i) => (
                    <F
                      key={l.seasonLeagueId}
                      label={l.label.toUpperCase()}
                      type="number"
                      value={l.number}
                      placeholder={draft.number || "inherit"}
                      onChange={v => onLeaguesChange(leagues.map((x, j) => (j === i ? { ...x, number: v } : x)))}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      </div>
    </BottomSheet>
  );
}

function AvatarPreview({ name, photoUrl }: { name: string; photoUrl: string }) {
  // Track which URL is broken; changing photoUrl naturally clears the broken state.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const showImg = !!photoUrl && brokenUrl !== photoUrl;
  if (showImg) {
    return (
      <Image
        src={cloudinaryThumb(photoUrl, 160)}
        alt=""
        width={64}
        height={64}
        onError={() => setBrokenUrl(photoUrl)}
        className="h-16 w-16 rounded-full border border-ak-border2 object-cover"
        style={{ objectPosition: "top center" }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-ak-border2 bg-[#111111] text-[16px] font-extrabold tracking-[0.04em] text-white"
    >
      {initials(name)}
    </span>
  );
}
