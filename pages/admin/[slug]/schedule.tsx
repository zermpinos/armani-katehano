/**
 * pages/admin/[slug]/schedule.tsx
 * Upcoming games — view, edit, delete all scheduled games.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { AdminLayout, Spinner, LoginForm, F, Sel, Btn, Confirm, useAdminAuth, apiFetch } from "@/client/admin";
import type { ScheduledGame } from "@/client/admin";
import { validateAdminSlug } from '@/server/auth';
import { fmtDate } from "@/domain/shared/format";

type ScheduleDraft = Partial<ScheduledGame> & { date?: string; time?: string };

type ImportJob = {
  id: string;
  upcomingGameId: string;
  state: "PENDING" | "IMPORTED" | "ERROR" | "ABANDONED";
  attempts: number;
  lastError: string | null;
};

const JOB_BADGE: Record<string, string> = {
  PENDING:   "text-ak-gold",
  IMPORTED:  "text-ak-green",
  ERROR:     "text-ak-red-text",
  ABANDONED: "text-ak-text-dim",
};

export default function SchedulePage({ validSlug }: { validSlug: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: checking, loginError, handleLogin, handleLogout } = useAdminAuth(slug);

  const [schedule,  setSchedule]  = useState<ScheduledGame[]>([]);
  const [jobMap,    setJobMap]    = useState<Map<string, ImportJob>>(new Map());
  const [loading,   setLoading]   = useState(false);
  const [toast,     setToast]     = useState<{ msg: string; type?: string } | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [draft,  setDraft]  = useState<ScheduleDraft>({});
  const [confirm, setConfirm] = useState<ScheduledGame | null>(null);

  const showToast = (msg: string, type = "success") => setToast({ msg, type });

  const loadData = async () => {
    setLoading(true);
    try {
      const [schedRes, jobsRes] = await Promise.all([
        fetch("/api/admin/schedule"),
        fetch("/api/admin/import-jobs"),
      ]);
      if (schedRes.ok) {
        const d = await schedRes.json();
        setSchedule(d.schedule ?? []);
      }
      if (jobsRes.ok) {
        const d = await jobsRes.json();
        const m = new Map<string, ImportJob>();
        for (const j of (d.jobs ?? [])) m.set(j.upcomingGameId, j);
        setJobMap(m);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (authed && slug) loadData();
  }, [authed, slug]);

  const startNew = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const dateStr = `${day}-${month}-${year}`;
    const timeStr = "20:00";
    setDraft({ opponent: "", date: dateStr, time: timeStr, location: "home", competition: "", notes: "", sourceUrl: "", listingUrl: "" });
    setEditId("new");
  };

  const startEdit = (g: ScheduledGame) => {
    const iso = g.scheduledFor;
    const date = new Date(iso);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const dateStr = `${day}-${month}-${year}`;
    const timeStr = iso.slice(11, 16);
    setDraft({ ...g, date: dateStr, time: timeStr });
    setEditId(g.id);
  };

  const cancel   = () => { setEditId(null); setDraft({}); };
  const updGame  = (k: string, v: unknown) => setDraft(d => ({ ...d, [k]: v } as ScheduleDraft));

  const save = async () => {
    if (!draft.opponent || !draft.date || !draft.time) {
      showToast("Opponent, date, and time are required", "error");
      return;
    }
    const isNew = editId === "new";
    // Convert DD-MM-YYYY to YYYY-MM-DD and combine with time: "2026-04-09T20:00:00Z"
    const [day, month, year] = draft.date.split("-");
    const scheduledFor = `${year}-${month}-${day}T${draft.time}:00`;
    const res = await apiFetch("/api/admin/schedule", {
      method:  isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isNew ? {} : { id: editId }),
        opponent:     draft.opponent,
        scheduledFor: scheduledFor,
        location:     draft.location,
        competition:  draft.competition || null,
        notes:        draft.notes || null,
        sourceUrl:    draft.sourceUrl || null,
        listingUrl:   draft.listingUrl || null,
      }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
    showToast(isNew ? "Game added!" : "Game saved!");
    cancel();
    loadData();
  };

  const deleteGame = async (g: ScheduledGame) => {
    const res = await apiFetch("/api/admin/schedule", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: g.id }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
    showToast("Game deleted.");
    setConfirm(null);
    loadData();
  };

  const fmtTime = (isoStr: string) => isoStr.slice(11, 16);

  const doJobAction = async (jobId: string, action: "run-now" | "abandon" | "reset") => {
    const res = await apiFetch(`/api/admin/import-jobs/${jobId}/${action}`, { method: "POST" });
    if (!res.ok) { const d = await res.json(); showToast(d.error ?? "Error", "error"); return; }
    showToast(action === "run-now" ? "Import triggered" : action === "abandon" ? "Abandoned" : "Reset");
    loadData();
  };

  const gameForm = (
    <div className={[
      "rounded-xl border p-4 bg-ak-base mt-2",
      editId === "new" ? "border-[#4caf7d40]" : "border-[#c0392b40]",
    ].join(" ")}>
      <div className={[
        "text-[10px] font-black tracking-[0.15em] mb-3 uppercase",
        editId === "new" ? "text-ak-green" : "text-ak-red-text",
      ].join(" ")}>
        {editId === "new" ? "NEW GAME" : "EDITING GAME"}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-[10px] mb-3">
        <F label="OPPONENT" value={draft.opponent ?? ""} onChange={v => updGame("opponent", v)} />
        <F label="DATE (DD-MM-YYYY)" value={draft.date ?? ""} onChange={v => updGame("date", v)} placeholder="09-04-2026" />
        <F label="TIME" value={draft.time ?? ""} onChange={v => updGame("time", v)} placeholder="18:45" type="time" />
        <Sel label="HOME/AWAY" value={draft.location ?? "home"} onChange={v => updGame("location", v)} options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]} />
        <F label="COMPETITION" value={draft.competition ?? ""} onChange={v => updGame("competition", v)} placeholder="e.g. Super Winter Cup" />
      </div>
      <div className="mb-3">
        <F label="SOURCE URL" value={draft.sourceUrl ?? ""} onChange={v => updGame("sourceUrl", v)} placeholder="https://basketcity.sportstats.gr/.../gamedetails/..." />
      </div>
      <div className="mb-3">
        <F label="LISTING URL" value={draft.listingUrl ?? ""} onChange={v => updGame("listingUrl", v)} placeholder="https://basketcity.sportstats.gr/<league>/teamdetails/id/<UUID>" />
        <div className="text-[10px] text-ak-text-dim mt-1 leading-relaxed">
          Team fixtures page. Used to auto-discover the source URL ~1h after tip-off.<br />
          Men: <code>/men/teamdetails/id/&lt;uuid&gt;</code><br />
          Cup: <code>/master-winter-cup/teamdetails/id/&lt;uuid&gt;</code>
        </div>
      </div>
      <div className="mb-3">
        <F label="NOTES" value={draft.notes ?? ""} onChange={v => updGame("notes", v)} placeholder="Optional notes" />
      </div>
      <div className="flex gap-[10px]">
        <Btn onClick={save}>SAVE</Btn>
        <Btn variant="ghost" onClick={cancel}>CANCEL</Btn>
      </div>
    </div>
  );

  if (checking) return (
    <div className="min-h-screen bg-ak-base flex items-center justify-center">
      <Spinner />
    </div>
  );

  if (!authed) return (
    <div className="min-h-screen bg-ak-base flex items-center justify-center p-4">
      <LoginForm onLogin={handleLogin} error={loginError} />
    </div>
  );

  return (
    <AdminLayout slug={slug} title="Schedule" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <div className="mb-5 flex justify-between items-center">
        <div className="text-[20px] font-black text-ak-text">Upcoming games</div>
        <Btn onClick={startNew}>+ ADD GAME</Btn>
      </div>

      {loading ? (
        <div className="flex justify-center py-[60px]"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-[6px]">
          {editId === "new" && gameForm}
          {[...schedule].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()).map(g => (
            <div key={g.id}>
              {editId === g.id ? gameForm : (
                <div className="flex items-center justify-between flex-wrap gap-2 py-[10px] px-[14px] rounded-[10px] border border-ak-border bg-ak-surface2">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-black text-[13px] text-ak-text">
                      {g.location === "home" ? "vs" : "@"} {g.opponent}
                    </div>
                    <div className="text-[11px] text-ak-text-dim mt-0.5">
                      {fmtDate(g.scheduledFor)} at {fmtTime(g.scheduledFor)}
                      {g.competition && <> · {g.competition}</>}
                      {g.sourceUrl && <span className="ml-1 text-ak-green font-bold" title={g.sourceUrl}>· URL ✓</span>}
                    </div>
                  </div>
                  {(() => {
                    const job = jobMap.get(g.id);
                    if (!job) return null;
                    const tooltip =
                      job.state === "IMPORTED"  ? "If you deleted the imported game, click RESET to re-import." :
                      job.state === "ABANDONED" ? "Discovery gave up after 4 attempts. RESET to try again."     :
                      job.state === "ERROR"     ? "Last scrape attempt errored. RESET to try again."            :
                      job.lastError ?? undefined;
                    return (
                      <div className="flex items-center gap-[6px] flex-wrap">
                        <span className={`text-[10px] font-black tracking-[0.12em] ${JOB_BADGE[job.state] ?? "text-ak-text-dim"}`}
                              title={tooltip}>
                          {job.state}
                          {job.attempts > 0 && <> ×{job.attempts}</>}
                        </span>
                        {job.state !== "IMPORTED" && (
                          <Btn size="sm" variant="green" onClick={() => doJobAction(job.id, "run-now")}>RUN</Btn>
                        )}
                        {(job.state === "PENDING" || job.state === "ERROR") && (
                          <Btn size="sm" variant="ghost" onClick={() => doJobAction(job.id, "abandon")}>ABANDON</Btn>
                        )}
                        {(job.state === "ERROR" || job.state === "ABANDONED" || job.state === "IMPORTED") && (
                          <Btn size="sm" variant="ghost" onClick={() => doJobAction(job.id, "reset")}>RESET</Btn>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex gap-[6px]">
                    <Btn size="sm" variant="ghost" onClick={() => startEdit(g)}>EDIT</Btn>
                    <Btn size="sm" variant="danger" onClick={() => setConfirm(g)}>DEL</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
          {schedule.length === 0 && editId !== "new" && (
            <div className="text-center py-5 text-ak-text-dim">
              No scheduled games yet
            </div>
          )}
        </div>
      )}

      {confirm && (
        <Confirm
          msg={`Delete game vs ${confirm.opponent} (${fmtDate(confirm.scheduledFor)})?`}
          onConfirm={() => deleteGame(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </AdminLayout>
  );
}

export async function getServerSideProps({ params }: { params: { slug: string } }) {
  if (!await validateAdminSlug(params.slug)) return { notFound: true };
  return { props: { validSlug: true } };
}
