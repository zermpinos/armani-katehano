import { BottomSheet, SheetError } from "@/client/admin/bottom-sheet";
import { F, Sel, Btn, Check, ArmedButton } from "@/client/admin/primitives";
import { byJersey, type League, type Player, type Season } from "@/client/admin/shared";
import type { NewSeasonDraft, SeasonDraft } from "./season-draft";

const HEADING = "mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-ak-text-dim";

export function SeasonSheet({
  open, resetKey, season, draft, linked, leagues, linkLeagueId, players, error, busy, canSave,
  onChange, onLinkChange, onLink, onSave, onArchive, onClose,
}: {
  open:         boolean;
  resetKey?:    number;
  season:       Season | null;
  draft:        SeasonDraft | null;
  linked:       string[];
  leagues:      League[];
  linkLeagueId: string;
  players:      Player[];
  error:        string | null;
  busy:         boolean;
  canSave:      boolean;
  onChange:     (d: SeasonDraft) => void;
  onLinkChange: (leagueId: string) => void;
  onLink:       () => void;
  onSave:       () => void;
  onArchive:    () => void;
  onClose:      () => void;
}) {
  const archived = Boolean(season?.archivedAt);
  const games    = season?.gameCount ?? 0;
  const sorted   = [...players].sort(byJersey);

  const togglePlayer = (id: string, on: boolean) => {
    if (!draft) return;
    const next = new Set(draft.playerIds);
    if (on) next.add(id); else next.delete(id);
    onChange({ ...draft, playerIds: next });
  };

  return (
    <BottomSheet
      open={open}
      resetKey={resetKey}
      title={season?.name ?? "Season"}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={onClose}>CLOSE</Btn>
            <Btn onClick={onSave} disabled={!canSave || busy}>{busy ? "SAVING..." : "SAVE"}</Btn>
          </div>
          {season && !busy && (archived || games > 0) && (
            <ArmedButton label={archived ? "UNARCHIVE" : "ARCHIVE"} onConfirm={onArchive} />
          )}
        </div>
      }
    >
      {error && <SheetError>{error}</SheetError>}
      {season && draft && (
        <div className="flex flex-col gap-6">
          <section>
            <p className="mb-3 text-[12px] text-ak-text-dim">
              Dates decide which season an imported game belongs to, so set the end date before the next season starts.
              Archiving a season shows fans a &apos;season complete&apos; banner and stops new imports landing in it.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <F label="STARTS" type="date" value={draft.start} onChange={v => onChange({ ...draft, start: v })} />
              <F label="ENDS" type="date" value={draft.end} onChange={v => onChange({ ...draft, end: v })} />
            </div>
            {!archived && games === 0 && (
              <p className="mt-2 text-[12px] text-ak-text-dim">No games in this season yet, so it cannot be archived.</p>
            )}
          </section>

          <section>
            <h3 className={HEADING}>Leagues</h3>
            <p className="text-[14px] text-ak-text">
              {linked.length ? linked.join(", ") : "No league linked yet. Games need one to record stats."}
            </p>
            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <Sel
                  label="LINK A LEAGUE"
                  value={linkLeagueId}
                  onChange={onLinkChange}
                  options={[{ value: "", label: "Choose a league" }, ...leagues.map(l => ({ value: l.id, label: l.name }))]}
                />
              </div>
              <Btn onClick={onLink} disabled={busy || !linkLeagueId}>LINK</Btn>
            </div>
          </section>

          <section>
            <h3 className={HEADING}>Roster ({draft.playerIds.size} of {players.length})</h3>
            {linked.length === 0 ? (
              <p className="text-[12px] text-ak-text-dim">Link a league to this season first.</p>
            ) : archived ? (
              <ul className="text-[14px] text-ak-text">
                {sorted.filter(p => draft.playerIds.has(p.id)).map(p => (
                  <li key={p.id} className="py-1">#{p.number} {p.name}</li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col">
                {sorted.map(p => (
                  <Check
                    key={p.id}
                    label={`#${p.number} ${p.name}`}
                    hint={p.position}
                    checked={draft.playerIds.has(p.id)}
                    onChange={on => togglePlayer(p.id, on)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </BottomSheet>
  );
}

export function NewSeasonSheet({ open, resetKey, draft, error, busy, onChange, onSave, onClose }: {
  open:      boolean;
  resetKey?: number;
  draft:     NewSeasonDraft;
  error:     string | null;
  busy:      boolean;
  onChange:  (d: NewSeasonDraft) => void;
  onSave:    () => void;
  onClose:   () => void;
}) {
  return (
    <BottomSheet
      open={open}
      resetKey={resetKey}
      title="Add a season"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={onClose}>CLOSE</Btn>
          <Btn onClick={onSave} disabled={busy}>{busy ? "CREATING..." : "CREATE SEASON"}</Btn>
        </div>
      }
    >
      {error && <SheetError>{error}</SheetError>}
      <p className="mb-4 text-[12px] text-ak-text-dim">Name + 4-digit year. Example: 2026-27 / 2026.</p>
      <div className="flex flex-col gap-3">
        <F label="NAME" value={draft.name} onChange={v => onChange({ ...draft, name: v })} placeholder="2026-27" />
        <F label="YEAR" type="number" value={draft.year} onChange={v => onChange({ ...draft, year: v })} placeholder="2026" />
      </div>
    </BottomSheet>
  );
}
