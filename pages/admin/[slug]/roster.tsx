/**
 * pages/admin/[slug]/roster.js
 * Roster management -- view, add, edit players.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { C } from "../../../lib/theme";
import { AdminLayout, Spinner, LoginForm, F, Sel, Btn, useAdminAuth, byJersey } from "../../../lib/adminShared";
import { validateAdminSlug } from '../../../lib/adminSlugCheck';
import { POSITIONS } from '../../../lib/positions';

export default function RosterPage({ validSlug }: any) {
  // A-02 fix: derive slug from the Next.js router, not window.location.
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: checking, loginError, handleLogin } = useAdminAuth(slug);

  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [draft,  setDraft]  = useState<Record<string, any>>({});

  const showToast = (msg: any, type = "success") => setToast({ msg, type });

  const loadPlayers = async () => {
    setLoading(true);
    try {
      // A-01 fix: pull players from the central /api/admin/data endpoint,
      // which is auth-gated by requireAuth and already returns the full player list.
      const res = await fetch("/api/admin/data");
      if (res.ok) {
        const d = await res.json();
        setPlayers(d.players ?? []);
      }
    } finally { setLoading(false); }
  };

  // A-02 fix: guard so we don't fire with an empty slug before the router hydrates.
  useEffect(() => {
    if (authed && slug) loadPlayers();
  }, [authed, slug]);

  const startNew  = () => { setDraft({ name: "", number: "", position: "PG", height: "", weight: "" }); setEditId("new"); };
  const startEdit = (p: any) => { setDraft({ ...p }); setEditId(p.id); };
  const cancel    = () => { setEditId(null); setDraft({}); };
  const upd       = (k: any, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));

  const save = async () => {
    const isNew = editId === "new";
    const res = await fetch("/api/admin/players", {
      method:  isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(isNew ? draft : { playerId: editId, ...draft }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error || "Save failed", "error"); return; }
    showToast(isNew ? "Player added!" : "Player saved!");
    cancel();
    loadPlayers();
  };

  const editForm = (
    <div style={{ borderRadius: 12, border: `1px solid ${editId === "new" ? `${C.green}40` : `${C.redBright}40`}`, padding: 16, background: C.base, marginTop: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: editId === "new" ? C.green : C.redText, marginBottom: 12, textTransform: "uppercase" }}>
        {editId === "new" ? "NEW PLAYER" : `EDITING: ${draft.name || "..."}`}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10, marginBottom: 12 }}>
        <F label="FULL NAME"  value={draft.name}     onChange={(v: any) => upd("name", v)} />
        <F label="JERSEY #"   value={draft.number}   onChange={(v: any) => upd("number", v)} type="number" />
        <Sel label="POSITION" value={draft.position || "PG"} onChange={(v: any) => upd("position", v)} options={POSITIONS.map(p => ({ value: p, label: p }))} />
        <F label="HEIGHT"     value={draft.height}   onChange={(v: any) => upd("height", v)} placeholder='e.g. 6&apos;4"' />
        <F label="WEIGHT"     value={draft.weight}   onChange={(v: any) => upd("weight", v)} placeholder="e.g. 90 kg" />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={save}>{editId === "new" ? "ADD PLAYER" : "SAVE PLAYER"}</Btn>
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
    <AdminLayout slug={slug} title="Roster" toast={toast} setToast={setToast}>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>Roster</div>
        <Btn onClick={startNew}>+ ADD PLAYER</Btn>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {editId === "new" && editForm}
          {[...players].sort(byJersey).map(p => (
            <div key={p.id}>
              {editId === p.id ? editForm : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, background: C.red, color: C.text, flexShrink: 0 }}>
                      #{p.number}
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 13, color: C.text }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: C.textDim }}>{p.position}{p.height ? ` · ${p.height}` : ""}{p.weight ? ` · ${p.weight}` : ""}</div>
                    </div>
                  </div>
                  <Btn size="sm" variant="ghost" onClick={() => startEdit(p)}>EDIT</Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

export async function getServerSideProps({ params }: any) {
  if (!await validateAdminSlug(params.slug)) return { notFound: true };
  return { props: { validSlug: true } };
}