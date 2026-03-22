/**
 * pages/admin/[slug]/seasons.js
 * Seasons & leagues management.
 */

import { useState, useEffect } from "react";
import { C } from "../../../lib/theme";
import { AdminLayout, F, Sel, Btn, Toast } from "../../../lib/adminShared";

export default function SeasonsPage({ validSlug }) {
  const slug = typeof window !== "undefined" ? window.location.pathname.split("/")[2] : "";

  const [authed,      setAuthed]      = useState(false);
  const [checking,    setChecking]    = useState(true);
  const [password,    setPassword]    = useState("");
  const [authError,   setAuthError]   = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [seasons,       setSeasons]       = useState([]);
  const [leagues,       setLeagues]       = useState([]);
  const [seasonLeagues, setSeasonLeagues] = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [toast,         setToast]         = useState(null);

  const [newSeason,    setNewSeason]    = useState({ name: "", year: "" });
  const [newLeague,    setNewLeague]    = useState({ name: "", organizer: "", level: "" });
  const [linkSeasonId, setLinkSeasonId] = useState("");
  const [linkLeagueId, setLinkLeagueId] = useState("");

  const showToast = (msg, type = "success") => setToast({ msg, type });

  useEffect(() => {
    if (!validSlug) { setChecking(false); return; }
    fetch("/api/auth", { method: "GET" })
      .then(r => { if (r.ok) { setAuthed(true); loadData(); } setChecking(false); })
      .catch(() => setChecking(false));
  }, [validSlug]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, lRes, slRes] = await Promise.all([
        fetch("/api/admin/seasons-list"),
        fetch("/api/admin/leagues-list"),
        fetch("/api/admin/season-leagues"),
      ]);
      if (sRes.ok)  { const d = await sRes.json();  setSeasons(d.seasons ?? []);         setLinkSeasonId(d.seasons?.[0]?.id ?? ""); }
      if (lRes.ok)  { const d = await lRes.json();  setLeagues(d.leagues ?? []);         setLinkLeagueId(d.leagues?.[0]?.id ?? ""); }
      if (slRes.ok) { const d = await slRes.json(); setSeasonLeagues(d.seasonLeagues ?? []); }
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
      if (res.ok) { setPassword(""); setAuthed(true); loadData(); }
      else {
        const d = await res.json();
        if (res.status === 429) setAuthError(`Too many attempts. Try again in ${Math.ceil((d.retryAfter || 900) / 60)} min.`);
        else setAuthError("Invalid credentials.");
      }
    } catch { setAuthError("Network error."); }
    finally { setAuthLoading(false); }
  };

  const createSeason = async () => {
    if (!newSeason.name || !newSeason.year) { showToast("Name and year required", "error"); return; }
    const res = await fetch("/api/admin/seasons", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSeason),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error || "Failed", "error"); return; }
    showToast("Season created!");
    setNewSeason({ name: "", year: "" });
    loadData();
  };

  const createLeague = async () => {
    if (!newLeague.name) { showToast("League name required", "error"); return; }
    const res = await fetch("/api/admin/leagues", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newLeague, seasonId: linkSeasonId }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error || "Failed", "error"); return; }
    showToast("League created and linked!");
    setNewLeague({ name: "", organizer: "", level: "" });
    loadData();
  };

  const linkLeague = async () => {
    if (!linkLeagueId || !linkSeasonId) return;
    const res = await fetch("/api/admin/seasons", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:      seasons.find(s => s.id === linkSeasonId)?.name,
        year:      seasons.find(s => s.id === linkSeasonId)?.year,
        leagueIds: [linkLeagueId],
      }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error || "Failed", "error"); return; }
    showToast("League linked to season!");
    loadData();
  };

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
    <AdminLayout slug={slug} title="Seasons" toast={toast} setToast={setToast}>
      <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 24 }}>Seasons & leagues</div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24 }}>

          {/* Active season leagues */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 12, textTransform: "uppercase" }}>Active season leagues</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
              {seasonLeagues.length === 0
                ? <div style={{ fontSize: 12, color: C.textDim }}>No leagues linked yet.</div>
                : seasonLeagues.map(sl => (
                  <div key={sl.id} style={{ padding: "10px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface2 }}>
                    <div style={{ fontWeight: 900, fontSize: 13, color: C.text }}>{sl.leagueName}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>{sl.seasonName} · {sl.leagueSlug}</div>
                  </div>
                ))
              }
            </div>

            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 10, textTransform: "uppercase" }}>Link existing league to season</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <Sel label="Season" value={linkSeasonId} onChange={setLinkSeasonId} options={seasons.map(s => ({ value: s.id, label: s.name }))} />
              <Sel label="League" value={linkLeagueId} onChange={setLinkLeagueId} options={leagues.map(l => ({ value: l.id, label: l.name }))} />
            </div>
            <Btn onClick={linkLeague} disabled={!linkSeasonId || !linkLeagueId}>LINK</Btn>
          </div>

          {/* Create season + league */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 12, textTransform: "uppercase" }}>Create new season</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              <F label="Name" value={newSeason.name} onChange={v => setNewSeason(s => ({ ...s, name: v }))} placeholder="e.g. 2026-27" />
              <F label="Year" value={newSeason.year} onChange={v => setNewSeason(s => ({ ...s, year: v }))} type="number" placeholder="e.g. 2026" />
            </div>
            <Btn onClick={createSeason} disabled={!newSeason.name || !newSeason.year}>CREATE SEASON</Btn>

            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, margin: "24px 0 12px", textTransform: "uppercase" }}>Create new league</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              <F label="Name"      value={newLeague.name}      onChange={v => setNewLeague(l => ({ ...l, name: v }))}      placeholder="e.g. BC6" />
              <F label="Organizer" value={newLeague.organizer} onChange={v => setNewLeague(l => ({ ...l, organizer: v }))} placeholder="e.g. Basket City" />
              <F label="Level"     value={newLeague.level}     onChange={v => setNewLeague(l => ({ ...l, level: v }))}     placeholder="e.g. Amateur" />
              <Sel label="Link to season" value={linkSeasonId} onChange={setLinkSeasonId} options={seasons.map(s => ({ value: s.id, label: s.name }))} />
            </div>
            <Btn onClick={createLeague} disabled={!newLeague.name}>CREATE LEAGUE</Btn>
          </div>
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
