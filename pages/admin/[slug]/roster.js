/**
 * pages/admin/[slug]/roster.js
 * Roster management -- view, add, edit players.
 */

import { useState, useEffect } from "react";
import { C } from "../../../lib/theme";
import { AdminLayout, F, Sel, Btn, Toast, byJersey } from "../../../lib/adminShared";

const POSITIONS = ["PG", "SG", "SF", "PF", "C", "PG/SG", "PG/SF", "SG/SF", "SF/PF", "PF/C"];

export default function RosterPage({ validSlug }) {
  const slug = typeof window !== "undefined" ? window.location.pathname.split("/")[2] : "";

  const [authed,      setAuthed]      = useState(false);
  const [checking,    setChecking]    = useState(true);
  const [password,    setPassword]    = useState("");
  const [authError,   setAuthError]   = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState(null);

  const [editId, setEditId] = useState(null);
  const [draft,  setDraft]  = useState({});

  const showToast = (msg, type = "success") => setToast({ msg, type });

  useEffect(() => {
    if (!validSlug) { setChecking(false); return; }
    fetch("/api/auth", { method: "GET" })
      .then(r => { if (r.ok) { setAuthed(true); loadPlayers(); } setChecking(false); })
      .catch(() => setChecking(false));
  }, [validSlug]);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/players");
      if (res.ok) { const d = await res.json(); setPlayers(d.players ?? []); }
    } finally { setLoading(false); }
  };

  const login = async (e) => {
    e.preventDefault();
    setAuthLoading(true); setAuthError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, slug }),
      });
      if (res.ok) { setPassword(""); setAuthed(true); loadPlayers(); }
      else {
        const d = await res.json();
        if (res.status === 429) setAuthError(`Too many attempts. Try again in ${Math.ceil((d.retryAfter || 900) / 60)} min.`);
        else setAuthError("Invalid credentials.");
      }
    } catch { setAuthError("Network error."); }
    finally { setAuthLoading(false); }
  };

  const startNew  = () => { setDraft({ name: "", number: "", position: "PG", height: "", weight: "" }); setEditId("new"); };
  const startEdit = p => { setDraft({ ...p }); setEditId(p.id); };
  const cancel    = () => { setEditId(null); setDraft({}); };
  const upd       = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const save = async () => {
    const isNew = editId === "new";
    const res = await fetch("/api/admin/players", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? draft : { playerId: editId, ...draft }),
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
        <F label="FULL NAME"  value={draft.name}     onChange={v => upd("name", v)} />
        <F label="JERSEY #"   value={draft.number}   onChange={v => upd("number", v)} type="number" />
        <Sel label="POSITION" value={draft.position || "PG"} onChange={v => upd("position", v)} options={POSITIONS.map(p => ({ value: p, label: p }))} />
        <F label="HEIGHT"     value={draft.height}   onChange={v => upd("height", v)} placeholder='e.g. 6&apos;4"' />
        <F label="WEIGHT"     value={draft.weight}   onChange={v => upd("weight", v)} placeholder="e.g. 90 kg" />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={save}>{editId === "new" ? "ADD PLAYER" : "SAVE PLAYER"}</Btn>
        <Btn variant="ghost" onClick={cancel}>CANCEL</Btn>
      </div>
    </div>
  );

  if (!validSlug) return null;

  if (checking) return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </div>
  );

  if (!authed) return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <LoginForm password={password} setPassword={setPassword} authError={authError} authLoading={authLoading} onSubmit={login} />
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

function Spinner() {
  return <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${C.border2}`, borderTopColor: C.redBright, animation: "spin 0.7s linear infinite" }} />;
}

function LoginForm({ password, setPassword, authError, authLoading, onSubmit }) {
  return (
    <div style={{ width: "100%", maxWidth: 360, borderRadius: 20, padding: 32, border: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22, background: `${C.red}18`, border: `1px solid ${C.red}45` }}>🔐</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>Admin Access</div>
      </div>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", marginBottom: 5, color: C.textDim, textTransform: "uppercase" }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
            style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, fontFamily: "inherit", outline: "none" }} />
        </div>
        {authError && <div style={{ fontSize: 12, color: C.redText }}>{authError}</div>}
        <button type="submit" disabled={authLoading || !password}
          style={{ padding: "12px", fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 10, border: "none", background: C.red, color: C.text, cursor: "pointer", fontFamily: "inherit", opacity: authLoading || !password ? 0.5 : 1 }}>
          {authLoading ? "VERIFYING..." : "SIGN IN"}
        </button>
      </form>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const { slug } = params;
  const expected = process.env.ADMIN_SLUG;
  let validSlug = false;
  try {
    const crypto = await import("crypto");
    const a = Buffer.from(slug || "");
    const b = Buffer.from(expected || "");
    if (a.length === b.length) validSlug = crypto.timingSafeEqual(a, b);
  } catch { validSlug = slug === expected; }
  return { props: { validSlug } };
}
