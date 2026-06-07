import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { AdminLayout, Spinner, PasskeyLoginForm, F, Sel, Btn, Confirm, useAdminAuth, apiFetch } from "@/client/admin";
import type { ScheduledGame } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";

type Draft = {
  opponent:    string;
  date:        string;
  time:        string;
  location:    "home" | "away";
  competition: string;
  sourceUrl:   string;
  notes:       string;
};

const EMPTY: Draft = {
  opponent: "", date: "", time: "20:00",
  location: "home", competition: "", sourceUrl: "", notes: "",
};

function todayDDMMYYYY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function gameToDraft(g: ScheduledGame): Draft {
  const date = new Date(g.scheduledFor);
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const y = date.getUTCFullYear();
  return {
    opponent:    g.opponent,
    date:        `${d}-${m}-${y}`,
    time:        g.scheduledFor.slice(11, 16),
    location:    g.location,
    competition: g.competition ?? "",
    sourceUrl:   g.sourceUrl ?? "",
    notes:       g.notes ?? "",
  };
}

export default function ScheduleEditPage({
  validSlug, showFallback, noPasskeys,
}: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;
  const idParam = typeof router.query.id === "string" ? router.query.id : null;
  const isNew = idParam === "new";

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [draft,    setDraft]    = useState<Draft>({ ...EMPTY, date: todayDDMMYYYY() });
  const [loading,  setLoading]  = useState(!isNew);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [askDelete,   setAskDelete]   = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; type?: string } | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    if (!authed || !slug || isNew || !idParam) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/schedule");
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      const game = (data.schedule as ScheduledGame[] | undefined)?.find(g => g.id === idParam);
      if (cancelled) return;
      if (!game) { setNotFound(true); setLoading(false); return; }
      setDraft(gameToDraft(game));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router.isReady, authed, slug, idParam, isNew]);

  const upd = (k: keyof Draft, v: string) => setDraft(d => ({ ...d, [k]: v }));

  const save = async () => {
    if (!draft.opponent || !draft.date || !draft.time) {
      setToast({ msg: "Opponent, date, and time are required", type: "error" });
      return;
    }
    const parts = draft.date.split("-");
    if (parts.length !== 3) {
      setToast({ msg: "Date must be DD-MM-YYYY", type: "error" });
      return;
    }
    const [d, m, y] = parts;
    const scheduledFor = `${y}-${m}-${d}T${draft.time}:00`;
    setSaving(true);
    const res = await apiFetch("/api/admin/schedule", {
      method:  isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isNew ? {} : { id: idParam }),
        opponent:     draft.opponent,
        scheduledFor,
        location:     draft.location,
        competition:  draft.competition || null,
        notes:        draft.notes || null,
        sourceUrl:    draft.sourceUrl || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setToast({ msg: body.error ?? "Save failed", type: "error" });
      setSaving(false);
      return;
    }
    router.push(`/admin/${slug}/schedule?saved=${isNew ? "created" : "updated"}`);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await apiFetch("/api/admin/schedule", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: idParam }),
    });
    if (!res.ok) {
      const body = await res.json();
      setToast({ msg: body.error ?? "Delete failed", type: "error" });
      setDeleting(false);
      setAskDelete(false);
      return;
    }
    router.push(`/admin/${slug}/schedule?saved=deleted`);
  };

  if (!validSlug) return null;
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base"><Spinner /></div>
  );
  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base p-4">
      <PasskeyLoginForm onPasskeyLogin={handlePasskeyLogin} onFallbackLogin={handleLogin} loginError={loginError} showFallback={showFallback} noPasskeys={noPasskeys} />
    </div>
  );

  const title = isNew ? "Schedule new game" : "Edit game";

  return (
    <AdminLayout slug={slug} title={title} toast={toast} setToast={setToast} onLogout={handleLogout}>
      <Link
        href={`/admin/${slug}/schedule`}
        className="inline-flex items-center gap-1 text-[11px] font-black tracking-[0.12em] uppercase text-ak-text-dim mb-3"
      >
        ← Schedule
      </Link>
      <h1 className="text-[22px] md:text-[28px] font-black text-ak-text mb-6">{title}</h1>

      {loading ? (
        <div className="flex justify-center py-[60px]"><Spinner /></div>
      ) : notFound ? (
        <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
          <div className="text-[15px] font-black text-ak-text mb-1">Game not found</div>
          <div className="text-[12px] text-ak-text-dim mb-4">
            It may have been deleted.
          </div>
          <Link
            href={`/admin/${slug}/schedule`}
            className="text-[11px] font-black tracking-[0.12em] uppercase text-ak-red-text"
          >
            ← Back to schedule
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-ak-border bg-ak-surface p-4 md:p-5 mb-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <F label="OPPONENT" value={draft.opponent} onChange={v => upd("opponent", v)} />
              <Sel
                label="HOME / AWAY"
                value={draft.location}
                onChange={v => upd("location", v)}
                options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]}
              />
              <F label="DATE (DD-MM-YYYY)" value={draft.date} onChange={v => upd("date", v)} placeholder="09-04-2026" />
              <F label="TIME" value={draft.time} onChange={v => upd("time", v)} placeholder="18:45" type="time" />
              <F label="COMPETITION" value={draft.competition} onChange={v => upd("competition", v)} placeholder="e.g. Super Winter Cup" />
            </div>
            <div className="mb-4">
              <F label="SOURCE URL" value={draft.sourceUrl} onChange={v => upd("sourceUrl", v)} placeholder="https://basketcity.sportstats.gr/.../gamedetails/..." />
              <div className="mt-1 text-[10px] text-ak-text-dim leading-relaxed">
                Optional. Set after the game once you have the box-score URL, or leave blank and use Import.
              </div>
            </div>
            <F label="NOTES" value={draft.notes} onChange={v => upd("notes", v)} placeholder="Optional notes" />
          </div>

          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-ak-base border-t border-ak-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Btn onClick={save} disabled={saving}>{saving ? "SAVING..." : isNew ? "SAVE" : "SAVE CHANGES"}</Btn>
              <Link
                href={`/admin/${slug}/schedule`}
                className="py-[9px] px-[18px] text-[13px] font-black tracking-[0.12em] rounded-lg border border-ak-border2 text-ak-text-sub"
              >
                CANCEL
              </Link>
            </div>
            {!isNew && (
              <Btn variant="danger" onClick={() => setAskDelete(true)} disabled={deleting}>
                {deleting ? "DELETING..." : "DELETE"}
              </Btn>
            )}
          </div>
        </>
      )}

      {askDelete && (
        <Confirm
          msg={`Delete game vs ${draft.opponent}?`}
          onConfirm={handleDelete}
          onCancel={() => setAskDelete(false)}
        />
      )}
    </AdminLayout>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
