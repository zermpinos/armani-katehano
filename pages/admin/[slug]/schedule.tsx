/**
 * pages/admin/[slug]/schedule.tsx
 * Upcoming games -- view, edit, delete all scheduled games.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { C } from "../../../lib/theme";
import { AdminLayout, Spinner, LoginForm, F, Sel, Btn, Confirm, useAdminAuth } from "../../../lib/adminShared";
import { validateAdminSlug } from '../../../lib/adminSlugCheck';
import { fmtDate } from "../../../lib/utils";

export default function SchedulePage({ validSlug }: any) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: checking, loginError, handleLogin } = useAdminAuth(slug);

  const [schedule,  setSchedule]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [toast,     setToast]     = useState<{ msg: string; type?: string } | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [draft,  setDraft]  = useState<Record<string, any>>({});
  const [confirm, setConfirm] = useState<any>(null);

  const showToast = (msg: any, type = "success") => setToast({ msg, type });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/schedule");
      if (res.ok) {
        const d = await res.json();
        setSchedule(d.schedule ?? []);
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
    setDraft({ opponent: "", date: dateStr, time: timeStr, location: "home", competition: "", notes: "" });
    setEditId("new");
  };

  const startEdit = (g: any) => {
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
  const updGame  = (k: any, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!draft.opponent || !draft.date || !draft.time) {
      showToast("Opponent, date, and time are required", "error");
      return;
    }
    const isNew = editId === "new";
    // Convert DD-MM-YYYY to YYYY-MM-DD and combine with time: "2026-04-09T20:00:00Z"
    const [day, month, year] = draft.date.split("-");
    const scheduledFor = `${year}-${month}-${day}T${draft.time}:00Z`;
    const res = await fetch("/api/admin/schedule", {
      method:  isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isNew ? {} : { id: editId }),
        opponent:     draft.opponent,
        scheduledFor: scheduledFor,
        location:     draft.location,
        competition:  draft.competition || null,
        notes:        draft.notes || null,
      }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
    showToast(isNew ? "Game added!" : "Game saved!");
    cancel();
    loadData();
  };

  const deleteGame = async (g: any) => {
    const res = await fetch("/api/admin/schedule", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: g.id }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
    showToast("Game deleted.");
    setConfirm(null);
    loadData();
  };

  // Format time from ISO string: "2026-04-09T18:45:00.000Z" -> "18:45"
  const fmtTime = (isoStr: string) => {
    return isoStr.slice(11, 16);
  };

  const gameForm = (
    <div style={{ borderRadius: 12, border: `1px solid ${editId === "new" ? `${C.green}40` : `${C.redBright}40`}`, padding: 16, background: C.base, marginTop: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: editId === "new" ? C.green : C.redText, marginBottom: 12, textTransform: "uppercase" }}>
        {editId === "new" ? "NEW GAME" : "EDITING GAME"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10, marginBottom: 12 }}>
        <F label="OPPONENT" value={draft.opponent} onChange={(v: any) => updGame("opponent", v)} />
        <F label="DATE (DD-MM-YYYY)" value={draft.date} onChange={(v: any) => updGame("date", v)} placeholder="09-04-2026" />
        <F label="TIME" value={draft.time} onChange={(v: any) => updGame("time", v)} placeholder="18:45" type="time" />
        <Sel label="HOME/AWAY" value={draft.location} onChange={(v: any) => updGame("location", v)} options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]} />
        <F label="COMPETITION" value={draft.competition} onChange={(v: any) => updGame("competition", v)} placeholder="e.g. Super Winter Cup" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <F label="NOTES" value={draft.notes} onChange={(v: any) => updGame("notes", v)} placeholder="Optional notes" />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={save}>SAVE</Btn>
        <Btn variant="ghost" onClick={cancel}>CANCEL</Btn>
      </div>
    </div>
  );

  if (checking) return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </div>
  );

  if (!authed) return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <LoginForm onLogin={handleLogin} error={loginError} />
    </div>
  );

  return (
    <AdminLayout slug={slug} title="Schedule" toast={toast} setToast={setToast}>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>Upcoming games</div>
        <Btn onClick={startNew}>+ ADD GAME</Btn>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {editId === "new" && gameForm}
          {[...schedule].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()).map(g => (
            <div key={g.id}>
              {editId === g.id ? gameForm : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface2 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 900, fontSize: 13, color: C.text }}>
                      {g.location === "home" ? "vs" : "@"} {g.opponent}
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                      {fmtDate(g.scheduledFor)} at {fmtTime(g.scheduledFor)}
                      {g.competition && <> · {g.competition}</>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn size="sm" variant="ghost" onClick={() => startEdit(g)}>EDIT</Btn>
                    <Btn size="sm" variant="danger" onClick={() => setConfirm(g)}>DEL</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
          {schedule.length === 0 && editId !== "new" && (
            <div style={{ textAlign: "center", padding: "20px 0", color: C.textDim }}>
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

export async function getServerSideProps({ params }: any) {
  if (!await validateAdminSlug(params.slug)) return { notFound: true };
  return { props: { validSlug: true } };
}
