/**
 * pages/admin/[slug]/games.js
 * Game list — view, edit, delete all games.
 */

import { useState } from "react";
import { C } from "../../../lib/theme";
import { AdminLayout, BoxScoreTable, F, Sel, Btn, Confirm, Toast, byJersey, useAdminAuth } from "../../../lib/adminShared";
import { validateAdminSlug } from '../../../lib/adminSlugCheck.js';

export default function GamesPage({ validSlug }) {
  const slug = typeof window !== "undefined" ? window.location.pathname.split("/")[2] : "";

  // Q-01: replaced ~25 lines of duplicated auth state + useEffect + login fn
  // with a single hook call. Spinner and LoginForm below are kept as themed
  // local components since they use C (theme tokens) for visual consistency.
  const { authed, loading: checking, loginError, handleLogin } = useAdminAuth(slug);

  const [players,       setPlayers]       = useState([]);
  const [games,         setGames]         = useState([]);
  const [seasonLeagues, setSeasonLeagues] = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [toast,         setToast]         = useState(null);

  const [editId,  setEditId]  = useState(null);
  const [draft,   setDraft]   = useState({});
  const [confirm, setConfirm] = useState(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  // loadData is called imperatively after auth is confirmed.
  // useAdminAuth handles the initial session check; we load data
  // once authed flips to true via the effect below.
  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, gRes, slRes] = await Promise.all([
        fetch("/api/admin/players"),
        fetch("/api/admin/games"),
        fetch("/api/admin/season-leagues"),
      ]);
      if (pRes.ok)  { const d = await pRes.json();  setPlayers(d.players ?? []); }
      if (gRes.ok)  { const d = await gRes.json();  setGames(d.games ?? []); }
      if (slRes.ok) { const d = await slRes.json(); setSeasonLeagues(d.seasonLeagues ?? []); }
    } finally { setLoading(false); }
  };

  // Trigger data load once authenticated (covers both session-restore and fresh login)
  useState(() => { if (authed) loadData(); }, [authed]);

  const leagueOptions = seasonLeagues.map(sl => ({ value: sl.id, label: sl.leagueName }));
  const emptyRow      = pid => ({ pid, min: 0, pts: 0, reb: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, eff: 0 });
  const buildBox      = existing => [...players].sort(byJersey).map(p => {
    const found = existing?.find(r => (r.pid || r.playerId) === p.id);
    return found || emptyRow(p.id);
  });

  const startNew = () => {
    setDraft({ date: "", opponent: "", home: true, result: "W", teamScore: "", opponentScore: "", seasonLeagueId: seasonLeagues[0]?.id ?? "", boxScore: buildBox([]) });
    setEditId("new");
  };

  const startEdit = g => {
    setDraft({ ...g, date: g.playedOn?.slice(0, 10) ?? "", home: g.location === "home", boxScore: buildBox(g.boxScore) });
    setEditId(g.id);
  };

  const cancel   = () => { setEditId(null); setDraft({}); };
  const updGame  = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const updBox   = (pid, k, v) => setDraft(d => ({
    ...d, boxScore: d.boxScore.map(r => (r.pid || r.playerId) === pid ? { ...r, [k]: parseFloat(v) || 0 } : r)
  }));

  const save = async () => {
    const isNew   = editId === "new";
    const boxScore = draft.boxScore.map(r => {
      const fg2m = r.fg2m || 0, fg2a = r.fg2a || 0;
      const fg3m = r.fg3m || 0, fg3a = r.fg3a || 0;
      return {
        playerId: r.pid || r.playerId,
        minutes:  r.min || r.minutes || 0,
        pts: r.pts || 0, reb: r.reb || 0, orb: r.orb || 0, drb: r.drb || 0,
        ast: r.ast || 0, stl: r.stl || 0, blk: r.blk || 0, tov: r.tov || 0,
        pf: r.pf || 0, fg2m, fg2a, fg3m, fg3a, fgm: fg2m + fg3m, fga: fg2a + fg3a,
        ftm: r.ftm || 0, fta: r.fta || 0,
      };
    });

    const res = await fetch("/api/admin/games", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId:         isNew ? undefined : editId,
        seasonLeagueId: draft.seasonLeagueId,
        opponent:       draft.opponent,
        location:       draft.home ? "home" : "away",
        teamScore:      Number(draft.teamScore) || 0,
        opponentScore:  Number(draft.opponentScore) || 0,
        result:         draft.result,
        playedOn:       draft.date,
        boxScore,
      }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
    showToast(isNew ? "Game added!" : "Game saved!");
    cancel();
    loadData();
  };

  const deleteGame = async (g) => {
    const res = await fetch("/api/admin/games", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: g.id, seasonLeagueId: g.seasonLeagueId }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
    showToast("Game deleted.");
    setConfirm(null);
    loadData();
  };

  const gameForm = (
    <div style={{ borderRadius: 12, border: `1px solid ${editId === "new" ? `${C.green}40` : `${C.redBright}40`}`, padding: 16, background: C.base, marginTop: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: editId === "new" ? C.green : C.redText, marginBottom: 12, textTransform: "uppercase" }}>
        {editId === "new" ? "NEW GAME" : "EDITING GAME"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10, marginBottom: 12 }}>
        <F label="DATE"       value={draft.date}          onChange={v => updGame("date", v)}          placeholder="YYYY-MM-DD" />
        <F label="OPPONENT"   value={draft.opponent}      onChange={v => updGame("opponent", v)} />
        <Sel label="LEAGUE"   value={draft.seasonLeagueId || ""} onChange={v => updGame("seasonLeagueId", v)} options={leagueOptions} />
        <Sel label="HOME/AWAY" value={draft.home ? "home" : "away"} onChange={v => updGame("home", v === "home")} options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]} />
        <Sel label="RESULT"   value={draft.result}        onChange={v => updGame("result", v)}        options={[{ value: "W", label: "Win" }, { value: "L", label: "Loss" }]} />
        <F label="OUR SCORE"  value={draft.teamScore}     onChange={v => updGame("teamScore", v)}     type="number" />
        <F label="OPP SCORE"  value={draft.opponentScore} onChange={v => updGame("opponentScore", v)} type="number" />
      </div>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, textTransform: "uppercase" }}>Box score</div>
      <BoxScoreTable players={players} rows={draft.boxScore || []} onUpdate={updBox} />
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Btn onClick={save}>SAVE GAME</Btn>
        <Btn variant="ghost" onClick={cancel}>CANCEL</Btn>
      </div>
    </div>
  );

  // ── 404 ───────────────────────────────────────────────────────────────────
  if (!validSlug) return null;

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
    <AdminLayout slug={slug} title="Games" toast={toast} setToast={setToast}>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>Game results</div>
        <Btn onClick={startNew}>+ ADD GAME</Btn>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {editId === "new" && gameForm}
          {[...games].sort((a, b) => new Date(b.playedOn) - new Date(a.playedOn)).map(g => (
            <div key={g.id}>
              {editId === g.id ? gameForm : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, background: g.result === "W" ? `${C.green}25` : `${C.red}25`, color: g.result === "W" ? C.green : C.redText, flexShrink: 0 }}>
                      {g.result}
                    </span>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 13, color: C.text }}>
                        {g.location === "home" ? "vs" : "@"} {g.opponent}
                        <span style={{ fontWeight: 400, color: C.textDim, marginLeft: 8 }}>{g.teamScore}–{g.opponentScore}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.textDim }}>
                        {g.playedOn?.slice(0, 10)} · {seasonLeagues.find(sl => sl.id === g.seasonLeagueId)?.leagueName ?? ""}
                      </div>
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
        </div>
      )}

      {confirm && (
        <Confirm
          msg={`Delete game vs ${confirm.opponent} (${confirm.playedOn?.slice(0, 10)})?`}
          onConfirm={() => deleteGame(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </AdminLayout>
  );
}

// ── Themed Spinner — kept local to preserve C (theme token) styling ───────────
// Q-01: auth state is now handled by useAdminAuth from adminShared.js.
// These presentational components stay here because they depend on C (theme tokens)
// and have a different visual design from the generic adminShared versions.
function Spinner() {
  return <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${C.border2}`, borderTopColor: C.redBright, animation: "spin 0.7s linear infinite" }} />;
}

// Q-01: LoginForm now receives (onLogin, error) from useAdminAuth instead of
// managing its own password state separately per-page.
function LoginForm({ onLogin, error }) {
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(password);
    setLoading(false);
  };

  return (
    <div style={{ width: "100%", maxWidth: 360, borderRadius: 20, padding: 32, border: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22, background: `${C.red}18`, border: `1px solid ${C.red}45` }}>🔐</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>Admin Access</div>
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", marginBottom: 5, color: C.textDim, textTransform: "uppercase" }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
            style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, fontFamily: "inherit", outline: "none" }} />
        </div>
        {error && <div style={{ fontSize: 12, color: C.redText }}>{error}</div>}
        <button type="submit" disabled={loading || !password}
          style={{ padding: "12px", fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 10, border: "none", background: C.red, color: C.text, cursor: "pointer", fontFamily: "inherit", opacity: loading || !password ? 0.5 : 1 }}>
          {loading ? "VERIFYING…" : "SIGN IN"}
        </button>
      </form>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const validSlug = await validateAdminSlug(params.slug);
  return { props: { validSlug } };
}