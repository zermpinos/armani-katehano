import { useState, useRef } from "react";
import Link from "next/link";
import type { GetServerSidePropsContext } from "next";
import {
  adminLayout, useAdminSession, useAdminData, optimisticSave, asSentence, apiFetch,
  Btn, ListRow, ShowAllToggle,
} from "@/client/admin";
import type { ScheduledGame, SaveResult } from "@/client/admin";
import { getAdminPageProps } from "@/server/auth";
import { fmtDate } from "@/domain/shared/format";
import { ScheduleSheet } from "@/client/admin/schedule/ScheduleSheet";
import {
  emptyScheduleDraft, toScheduleDraft, validateScheduleDraft,
  toSchedulePayload, toScheduledGame, isPlayed, todayIso, type ScheduleDraft,
} from "@/client/admin/schedule/schedule-draft";

const URL_ = "/api/admin/schedule";
type Data = { schedule?: ScheduledGame[] };
type Sheet = { id: string | null; draft: ScheduleDraft; error: string | null; openCount: number };

const NEW_KEY = "new";

// A module-level function, not inline in the component, so the lint purity check does not treat this Date.now() as a render-time call.
function tempScheduleId(): string {
  return `pending-${Date.now()}`;
}

export default function SchedulePage() {
  const { slug, setToast } = useAdminSession();
  const { data, error, refresh } = useAdminData<Data>(URL_);
  const [showAll, setShowAll] = useState(false);
  const [sheet,   setSheet]   = useState<Sheet | null>(null);
  // A ref, so a save still in flight reads the latest count and a reopen after it always remounts the form.
  const opens = useRef(0);
  // A ref, so a save that fails after the admin opened another sheet sees it and does not replace it.
  const sheetOpen = useRef(false);
  // Drafts held after a 401 or a failed save behind another sheet, so nothing typed is lost.
  const [kept,    setKept]    = useState<ReadonlyMap<string, ScheduleDraft>>(new Map());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  const all     = [...(data?.schedule ?? [])].sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor));
  const visible = showAll ? all : all.filter(g => !isPlayed(g));
  const hidden  = all.length - visible.length;

  const keep = (key: string, draft: ScheduleDraft | null) =>
    setKept(k => { const next = new Map(k); if (draft) next.set(key, draft); else next.delete(key); return next; });
  const open = (id: string | null, draft: ScheduleDraft, errorText: string | null = null) => {
    opens.current += 1;
    const openCount = opens.current;
    sheetOpen.current = true;
    setSheet({ id, draft, error: errorText, openCount });
  };
  const closeSheet = () => { sheetOpen.current = false; setSheet(null); };
  const openRow = (g: ScheduledGame) => open(g.id, kept.get(g.id) ?? toScheduleDraft(g));
  const openNew = () => open(null, kept.get(NEW_KEY) ?? emptyScheduleDraft(todayIso()));
  const markPending = (id: string, on: boolean) =>
    setPending(p => { const next = new Set(p); if (on) next.add(id); else next.delete(id); return next; });

  const finish = (key: string, id: string | null, draft: ScheduleDraft, result: SaveResult, okMsg: string) => {
    if (result.ok) {
      keep(key, null);
      setToast({ msg: okMsg, type: "success" });
    } else if (result.status === 401) {
      keep(key, draft);
    } else if (sheetOpen.current) {
      // The admin opened another sheet meanwhile; a failed save must not replace what they are looking at now.
      keep(key, draft);
      const label = draft.opponent.trim() || "the fixture";
      const msg = id === null
        ? `Could not add ${label}: ${asSentence(result.message)} Tap + SCHEDULE GAME to try again.`
        : `Could not save ${label}: ${asSentence(result.message)} Tap it to try again.`;
      setToast({ msg, type: "error" });
    } else {
      open(id, draft, result.message);
    }
  };

  const save = async () => {
    if (!sheet) return;
    const { id, draft } = sheet;
    const invalid = validateScheduleDraft(draft);
    if (invalid) { setSheet({ ...sheet, error: invalid }); return; }
    closeSheet();
    const payload = toSchedulePayload(draft);

    if (id === null) {
      const tempId = tempScheduleId();
      markPending(tempId, true);
      const result = await optimisticSave<Data>({
        url: URL_,
        apply:    d => ({ ...d, schedule: [...(d.schedule ?? []), toScheduledGame(tempId, draft)] }),
        rollback: d => ({ ...d, schedule: (d.schedule ?? []).filter(g => g.id !== tempId) }),
        send: () => apiFetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
      });
      // On success the temp row stays pending until the reconcile swaps in the real row, so it is never briefly tappable with a stale id.
      if (!result.ok) markPending(tempId, false);
      finish(NEW_KEY, null, draft, result, "Game scheduled.");
      return;
    }

    const original = all.find(g => g.id === id);
    if (!original) return;
    markPending(id, true);
    const result = await optimisticSave<Data>({
      url: URL_,
      apply:    d => ({ ...d, schedule: (d.schedule ?? []).map(g => (g.id === id ? toScheduledGame(id, draft) : g)) }),
      rollback: d => ({ ...d, schedule: (d.schedule ?? []).map(g => (g.id === id ? original : g)) }),
      send: () => apiFetch(URL_, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...payload }) }),
    });
    markPending(id, false);
    finish(id, id, draft, result, "Fixture saved.");
  };

  const remove = async () => {
    if (!sheet?.id) return;
    const { id, draft } = sheet;
    const original = all.find(g => g.id === id);
    if (!original) return;
    closeSheet();
    markPending(id, true);
    const result = await optimisticSave<Data>({
      url: URL_,
      apply:    d => ({ ...d, schedule: (d.schedule ?? []).filter(g => g.id !== id) }),
      rollback: d => ({ ...d, schedule: [...(d.schedule ?? []), original] }),
      send: () => apiFetch(URL_, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }),
    });
    markPending(id, false);
    finish(id, id, draft, result, "Fixture deleted.");
  };

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-black text-ak-text md:text-[28px]">Schedule</h1>
        <Btn onClick={openNew} disabled={data === undefined}>+ SCHEDULE GAME</Btn>
      </header>

      {data === undefined && !error ? (
        <ListSkeleton />
      ) : data === undefined ? (
        <LoadFailed onRetry={() => void refresh()} />
      ) : (
        <>
          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center text-[13px] text-ak-text-dim">
              No upcoming games. Tap + Schedule game to add the next fixture.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map(g => (
                <li key={g.id}>
                  <ListRow
                    onClick={() => openRow(g)}
                    pending={pending.has(g.id)}
                    aside={!pending.has(g.id) && isPlayed(g) && !g.sourceUrl ? (
                      <Link
                        href={`/admin/${slug}/import?upcomingGameId=${g.id}`}
                        className="flex min-h-[44px] items-center rounded-md border border-ak-border2 px-3 text-[11px] font-black uppercase tracking-[0.12em] text-ak-text-sub"
                      >
                        Import
                      </Link>
                    ) : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-ak-text-dim">{g.location === "home" ? "vs" : "@"}</span>
                      <span className="truncate text-[15px] font-black text-ak-text">{g.opponent}</span>
                    </div>
                    <div className="mt-1 text-[12px] text-ak-text-dim">{fmtDate(g.scheduledFor)} · {g.scheduledFor.slice(11, 16)}</div>
                  </ListRow>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <ShowAllToggle showAll={showAll} onToggle={() => setShowAll(s => !s)} hiddenCount={hidden} hiddenLabel="played" />
          </div>
        </>
      )}

      <ScheduleSheet
        open={sheet !== null}
        resetKey={sheet?.openCount}
        isNew={sheet?.id === null}
        draft={sheet?.draft ?? emptyScheduleDraft("")}
        error={sheet?.error ?? null}
        onChange={d => setSheet(s => (s ? { ...s, draft: d, error: null } : s))}
        onSave={() => void save()}
        onClose={() => {
          if (sheet) keep(sheet.id ?? NEW_KEY, null);
          closeSheet();
        }}
        onDelete={sheet?.id ? () => void remove() : undefined}
      />
    </>
  );
}

SchedulePage.getLayout = adminLayout("Schedule");

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
      <div className="mb-4 text-[12px] text-ak-text-dim">Could not load the schedule.</div>
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
