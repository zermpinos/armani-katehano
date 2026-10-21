import { BottomSheet, SheetError } from "@/client/admin/bottom-sheet";
import { F, Sel, Btn } from "@/client/admin/primitives";
import type { League, Season } from "@/client/admin/shared";
import { ORGANIZATIONS } from "@/domain/leagues/organizations";
import type { LeagueDraft } from "./season-draft";

const LISTING_PLACEHOLDER = "https://basketcity.sportstats.gr/men/teamdetails/id/...";
const ORGANIZATION_OPTIONS = Object.entries(ORGANIZATIONS).map(([value, org]) => ({ value, label: org.name }));

export function LeagueSheet({ open, resetKey, league, listingUrl, error, busy, onChange, onSave, onClose }: {
  open:       boolean;
  resetKey?:  number;
  league:     League | null;
  listingUrl: string;
  error:      string | null;
  busy:       boolean;
  onChange:   (url: string) => void;
  onSave:     () => void;
  onClose:    () => void;
}) {
  return (
    <BottomSheet
      open={open}
      resetKey={resetKey}
      title={league?.name ?? "League"}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={onClose}>CLOSE</Btn>
          <Btn onClick={onSave} disabled={busy}>{busy ? "SAVING..." : "SAVE"}</Btn>
        </div>
      }
    >
      {error && <SheetError>{error}</SheetError>}
      <p className="mb-4 text-[12px] text-ak-text-dim">
        The team page the nightly poll reads for finished games. A league whose listing URL is empty is skipped,
        and the poll reports it rather than looking like a quiet week.
      </p>
      <F label="LISTING URL" value={listingUrl} onChange={onChange} placeholder={LISTING_PLACEHOLDER} />
    </BottomSheet>
  );
}

export function NewLeagueSheet({ open, resetKey, draft, seasons, error, busy, onChange, onSave, onClose }: {
  open:      boolean;
  resetKey?: number;
  draft:     LeagueDraft;
  seasons:   Season[];
  error:     string | null;
  busy:      boolean;
  onChange:  (d: LeagueDraft) => void;
  onSave:    () => void;
  onClose:   () => void;
}) {
  const set = (k: keyof LeagueDraft) => (v: string) => onChange({ ...draft, [k]: v });
  return (
    <BottomSheet
      open={open}
      resetKey={resetKey}
      title="Add a league"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={onClose}>CLOSE</Btn>
          <Btn onClick={onSave} disabled={busy}>{busy ? "CREATING..." : "CREATE LEAGUE"}</Btn>
        </div>
      }
    >
      {error && <SheetError>{error}</SheetError>}
      <p className="mb-4 text-[12px] text-ak-text-dim">
        Creates a league that does not exist yet and links it to the chosen season. To add an existing league to a
        season, open that season. Source slug is what the source site calls this competition in its URLs; listing URL
        is the page the nightly poll reads.
      </p>
      <div className="flex flex-col gap-3">
        <F label="NAME" value={draft.name} onChange={set("name")} placeholder="BC6" />
        <Sel label="ORGANIZATION" value={draft.organization} onChange={set("organization")} options={ORGANIZATION_OPTIONS} />
        <F label="SOURCE SLUG" value={draft.sourceSlug} onChange={set("sourceSlug")} placeholder="bc6" />
        <F label="LISTING URL" value={draft.listingUrl} onChange={set("listingUrl")} placeholder={LISTING_PLACEHOLDER} />
        <F label="ORGANIZER" value={draft.organizer} onChange={set("organizer")} placeholder="Basket City" />
        <F label="LEVEL" value={draft.level} onChange={set("level")} placeholder="Amateur" />
        {seasons.length > 0 && (
          <Sel
            label="LINK TO SEASON"
            value={draft.seasonId}
            onChange={set("seasonId")}
            options={seasons.map(s => ({ value: s.id, label: s.name }))}
          />
        )}
      </div>
    </BottomSheet>
  );
}
