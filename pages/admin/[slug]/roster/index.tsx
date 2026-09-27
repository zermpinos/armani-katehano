import Image from "next/image";
import { useState, useRef } from "react";
import type { GetServerSidePropsContext } from "next";
import {
  adminLayout, useAdminSession, useAdminData, optimisticSave, apiFetch, byJersey,
  Btn, ListRow, ShowAllToggle,
} from "@/client/admin";
import type { Player, SaveResult } from "@/client/admin";
import { getAdminPageProps } from "@/server/auth";
import { initials } from "@/domain/players/format";
import { cloudinaryThumb } from "@/domain/shared/cloudinary";
import { RosterSheet } from "@/client/admin/roster/RosterSheet";
import {
  EMPTY_PLAYER, toPlayerDraft, validatePlayerDraft, toPlayerPayload, toLeagueNumbers,
  leaguesChanged, toOptimisticPlayer, type PlayerDraft, type LeagueJersey,
} from "@/client/admin/roster/player-draft";

const URL_    = "/api/admin/players?all=1";
const PLAYERS = "/api/admin/players";
const NEW_KEY = "new";

type Data  = { players?: Player[] };
type Sheet = {
  id:             string | null;
  draft:          PlayerDraft;
  leagues:        LeagueJersey[] | null;
  initialLeagues: LeagueJersey[];
  error:          string | null;
  openCount:      number;
};

const jsonInit = (method: string, body: unknown) =>
  ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// A module-level function, not inline in the component, so the lint purity check does not treat this Date.now() as a render-time call.
function tempPlayerId(): string {
  return `pending-${Date.now()}`;
}

export default function RosterPage() {
  const { setToast } = useAdminSession();
  const { data, error, refresh } = useAdminData<Data>(URL_);
  const [showAll, setShowAll] = useState(false);
  const [sheet,   setSheet]   = useState<Sheet | null>(null);
  // Counts sheet opens across the component's life; a ref because a stale
  // closure reading it (from a save in flight) must see the latest value.
  const opens = useRef(0);
  // True whenever a sheet is on screen, so a save that fails after the admin
  // has since closed or reopened it knows not to clobber what they see now.
  const sheetOpen = useRef(false);
  // Drafts held only after a 401, so the admin can sign in again and carry on where they were.
  const [kept,    setKept]    = useState<ReadonlyMap<string, PlayerDraft>>(new Map());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  const all     = [...(data?.players ?? [])].sort(byJersey);
  const visible = showAll ? all : all.filter(p => p.isActive !== false);
  const hidden  = all.length - visible.length;

  const keep = (key: string, draft: PlayerDraft | null) =>
    setKept(k => { const next = new Map(k); if (draft) next.set(key, draft); else next.delete(key); return next; });
  const markPending = (id: string, on: boolean) =>
    setPending(p => { const next = new Set(p); if (on) next.add(id); else next.delete(id); return next; });

  const open = (id: string | null, draft: PlayerDraft, rest: Partial<Sheet> = {}) => {
    opens.current += 1;
    const openCount = opens.current;
    sheetOpen.current = true;
    setSheet({ id, draft, leagues: id === null ? [] : null, initialLeagues: [], error: null, ...rest, openCount });
    return openCount;
  };
  const closeSheet = () => { sheetOpen.current = false; setSheet(null); };

  const openNew = () => open(null, kept.get(NEW_KEY) ?? EMPTY_PLAYER);

  const openRow = (p: Player) => {
    const openCount = open(p.id, kept.get(p.id) ?? toPlayerDraft(p));
    void (async () => {
      const res  = await apiFetch(`/api/admin/roster-entries?playerId=${encodeURIComponent(p.id)}`).catch(() => null);
      const body = res?.ok ? await res.json().catch(() => ({})) : {};
      const leagues: LeagueJersey[] = (body.leagues ?? []).map(
        (l: { seasonLeagueId: string; label: string; number: number | null }) =>
          ({ seasonLeagueId: l.seasonLeagueId, label: l.label, number: l.number === null ? "" : String(l.number) }),
      );
      setSheet(s => (s && s.openCount === openCount ? { ...s, leagues, initialLeagues: leagues } : s));
    })();
  };

  const save = async () => {
    if (!sheet) return;
    const { id, draft, leagues, initialLeagues } = sheet;
    const invalid = validatePlayerDraft(draft, leagues ?? []);
    if (invalid) { setSheet({ ...sheet, error: invalid }); return; }
    closeSheet();
    const key = id ?? NEW_KEY;

    const finish = (result: SaveResult, okMsg: string) => {
      if (result.ok) {
        keep(key, null);
        setToast({ msg: okMsg, type: "success" });
      } else if (result.status === 401) {
        keep(key, draft);
      } else {
        // The player PUT may have landed before a jersey PATCH failed, so show the server's current list.
        void refresh();
        if (sheetOpen.current) {
          // The admin opened another sheet meanwhile; a failed save must not replace what they are looking at now.
          keep(key, draft);
          setToast({ msg: `Could not save ${draft.name.trim() || "the player"}: ${result.message} Tap it to try again.`, type: "error" });
        } else {
          open(id, draft, { leagues, initialLeagues, error: result.message });
        }
      }
    };

    if (id === null) {
      const tempId = tempPlayerId();
      markPending(tempId, true);
      const result = await optimisticSave<Data>({
        url: URL_,
        apply:    d => ({ ...d, players: [...(d.players ?? []), toOptimisticPlayer(tempId, draft)] }),
        rollback: d => ({ ...d, players: (d.players ?? []).filter(p => p.id !== tempId) }),
        send: () => apiFetch(PLAYERS, jsonInit("POST", toPlayerPayload(draft))),
      });
      // On success the temp row stays pending until the reconcile swaps in the real row, so it is never briefly tappable with a stale id.
      if (!result.ok) markPending(tempId, false);
      finish(result, "Player added.");
      return;
    }

    const original = all.find(p => p.id === id);
    if (!original) return;
    const numbersChanged = leagues !== null && leaguesChanged(initialLeagues, leagues);
    markPending(id, true);
    const result = await optimisticSave<Data>({
      url: URL_,
      apply:    d => ({ ...d, players: (d.players ?? []).map(p => (p.id === id ? toOptimisticPlayer(id, draft, original) : p)) }),
      rollback: d => ({ ...d, players: (d.players ?? []).map(p => (p.id === id ? original : p)) }),
      send: async () => {
        const res = await apiFetch(PLAYERS, jsonInit("PUT", { playerId: id, ...toPlayerPayload(draft) }));
        // Overrides only go out after the player saved, so a rejected player never leaves half a write.
        if (!res.ok || !numbersChanged || leagues === null) return res;
        return apiFetch("/api/admin/roster-entries", jsonInit("PATCH", { playerId: id, numbers: toLeagueNumbers(leagues) }));
      },
    });
    markPending(id, false);
    finish(result, original.isActive !== false && !draft.isActive ? "Player retired." : "Player saved.");
  };

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-black text-ak-text md:text-[28px]">Roster</h1>
        <Btn onClick={openNew}>+ ADD PLAYER</Btn>
      </header>

      {data === undefined && !error ? (
        <ListSkeleton />
      ) : data === undefined ? (
        <LoadFailed onRetry={() => void refresh()} />
      ) : (
        <>
          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center text-[13px] text-ak-text-dim">
              No active players. Tap + Add player to add the first one.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map(p => (
                <li key={p.id}>
                  <ListRow onClick={() => openRow(p)} pending={pending.has(p.id)}>
                    <div className="flex items-center gap-3">
                      <RowAvatar name={p.name} photoUrl={p.photoUrl ?? ""} />
                      <span className="w-8 text-[13px] font-black tabular-nums text-ak-text-dim">#{p.number}</span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-black text-ak-text">{p.name}</span>
                      <span className="text-[11px] font-bold text-ak-text-dim">{p.position}</span>
                      {p.isActive === false && (
                        <span className="rounded-md border border-ak-border2 px-2 py-[2px] text-[10px] font-black uppercase tracking-[0.1em] text-ak-text-dim">Retired</span>
                      )}
                    </div>
                  </ListRow>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <ShowAllToggle showAll={showAll} onToggle={() => setShowAll(s => !s)} hiddenCount={hidden} hiddenLabel="retired" />
          </div>
        </>
      )}

      <RosterSheet
        key={sheet ? sheet.openCount : "closed"}
        open={sheet !== null}
        isNew={sheet?.id === null}
        draft={sheet?.draft ?? EMPTY_PLAYER}
        leagues={sheet ? sheet.leagues : []}
        error={sheet?.error ?? null}
        onChange={d => setSheet(s => (s ? { ...s, draft: d, error: null } : s))}
        onLeaguesChange={l => setSheet(s => (s ? { ...s, leagues: l, error: null } : s))}
        onSave={() => void save()}
        onClose={() => {
          if (sheet) keep(sheet.id ?? NEW_KEY, null);
          closeSheet();
        }}
      />
    </>
  );
}

RosterPage.getLayout = adminLayout("Roster");

// Matches the previous list page's avatar approach: a boolean broken flag,
// alt text naming the player, and shrink-0 so a long name cannot squeeze it.
function RowAvatar({ name, photoUrl }: { name: string; photoUrl: string }) {
  const [broken, setBroken] = useState(false);
  if (photoUrl && !broken) {
    return (
      <Image
        src={cloudinaryThumb(photoUrl, 64)}
        alt={name}
        width={32}
        height={32}
        onError={() => setBroken(true)}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
        style={{ objectPosition: "top center" }}
      />
    );
  }
  return (
    <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111111] text-[11px] font-extrabold tracking-[0.04em] text-white">
      {initials(name)}
    </span>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
      <div className="mb-4 text-[12px] text-ak-text-dim">Could not load the roster.</div>
      <Btn size="sm" onClick={onRetry}>Retry</Btn>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1, 2].map(i => <li key={i} className="h-[64px] animate-pulse rounded-xl border border-ak-border bg-ak-surface" />)}
    </ul>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return getAdminPageProps(ctx);
}
