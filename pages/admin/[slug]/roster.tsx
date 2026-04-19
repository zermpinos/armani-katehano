/**
 * pages/admin/[slug]/roster.js
 * Roster management — view, add, edit players.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { AdminLayout, Spinner, LoginForm, F, Sel, Btn, useAdminAuth, byJersey, apiFetch } from "../../../lib/adminShared";
import { validateAdminSlug } from '../../../lib/adminSlugCheck';
import { POSITIONS } from '../../../lib/positions';

export default function RosterPage({ validSlug }: any) {
  // A-02 fix: derive slug from the Next.js router, not window.location.
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: checking, loginError, handleLogin, handleLogout } = useAdminAuth(slug);

  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [draft,  setDraft]  = useState<Record<string, any>>({});

  const showToast = (msg: any, type = "success") => setToast({ msg, type });

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/players");
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
    if (!draft.name?.trim())        { showToast("Name is required", "error"); return; }
    if (draft.number === "" || draft.number === undefined) { showToast("Jersey number is required", "error"); return; }
    const isNew = editId === "new";
    const res = await apiFetch("/api/admin/players", {
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
    <div className={[
      "rounded-xl border p-4 bg-ak-base mt-2",
      editId === "new" ? "border-[#4caf7d40]" : "border-[#c0392b40]",
    ].join(" ")}>
      <div className={[
        "text-[10px] font-black tracking-[0.15em] mb-3 uppercase",
        editId === "new" ? "text-ak-green" : "text-ak-red-text",
      ].join(" ")}>
        {editId === "new" ? "NEW PLAYER" : `EDITING: ${draft.name || "..."}`}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-[10px] mb-3">
        <F label="FULL NAME"  value={draft.name}     onChange={(v: any) => upd("name", v)} />
        <F label="JERSEY #"   value={draft.number}   onChange={(v: any) => upd("number", v)} type="number" />
        <Sel label="POSITION" value={draft.position || "PG"} onChange={(v: any) => upd("position", v)} options={POSITIONS.map(p => ({ value: p, label: p }))} />
        <F label="HEIGHT"     value={draft.height}   onChange={(v: any) => upd("height", v)} placeholder='e.g. 6&apos;4"' />
        <F label="WEIGHT"     value={draft.weight}   onChange={(v: any) => upd("weight", v)} placeholder="e.g. 90 kg" />
      </div>
      <div className="flex gap-[10px]">
        <Btn onClick={save}>{editId === "new" ? "ADD PLAYER" : "SAVE PLAYER"}</Btn>
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
    <AdminLayout slug={slug} title="Roster" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <div className="mb-5 flex justify-between items-center">
        <div className="text-[20px] font-black text-ak-text">Roster</div>
        <Btn onClick={startNew}>+ ADD PLAYER</Btn>
      </div>

      {loading ? (
        <div className="flex justify-center py-[60px]"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-[6px]">
          {editId === "new" && editForm}
          {[...players].sort(byJersey).map(p => (
            <div key={p.id}>
              {editId === p.id ? editForm : (
                <div className="flex items-center justify-between py-[10px] px-[14px] rounded-[10px] border border-ak-border bg-ak-surface2">
                  <div className="flex items-center gap-[10px]">
                    <div className="w-8 h-8 rounded-[7px] flex items-center justify-center text-[11px] font-black bg-ak-red text-ak-text shrink-0">
                      #{p.number}
                    </div>
                    <div>
                      <div className="font-black text-[13px] text-ak-text">{p.name}</div>
                      <div className="text-[11px] text-ak-text-dim">{p.position}{p.height ? ` · ${p.height}` : ""}{p.weight ? ` · ${p.weight}` : ""}</div>
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
