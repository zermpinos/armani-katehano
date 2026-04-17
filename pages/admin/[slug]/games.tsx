/**
 * pages/admin/[slug]/games.js
 * Game list -- view, edit, delete all games.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { C } from "../../../lib/theme";
import { AdminLayout, Spinner, LoginForm, BoxScoreTable, F, Sel, Btn, Confirm, useAdminAuth, byJersey } from "../../../lib/adminShared";
import { validateAdminSlug } from '../../../lib/adminSlugCheck';

export default function GamesPage({ validSlug }: any) {
  // A-02 fix: derive slug from the Next.js router, not window.location.
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: checking, loginError, handleLogin, handleLogout } = useAdminAuth(slug);

  const [players,       setPlayers]       = useState<any[]>([]);
  const [games,         setGames]         = useState<any[]>([]);
  const [seasonLeagues, setSeasonLeagues] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [draft,   setDraft]   = useState<Record<string, any>>({});
  const [confirm, setConfirm] = useState<any>(null);

  const showToast = (msg: any, type = "success") => setToast({ msg, type });

  const loadData = async () => {
    setLoading(true);
    try {
      // A-01 fix: use the single /api/admin/data endpoint which already returns
      // players, games, and seasonLeagues in one request, rather than three
      // separate /api/admin/* fetches that don't exist in the route manifest.
      const res = await fetch("/api/admin/data");
      if (res.ok) {
        const d = await res.json();
        setPlayers(d.players ?? []);
        setGames(d.games ?? []);
        setSeasonLeagues(d.seasonLeagues ?? []);
      }
    } finally { setLoading(false); }
  };

  // A-02 fix: guard so we don't fire with an empty slug before the router hydrates.
  useEffect(() => {
    if (authed && slug) loadData();
  }, [authed, slug]);

  const leagueOptions = seasonLeagues.map(sl => ({ value: sl.id, label: sl.leagueName }));
  const emptyRow      = (playerId: any) => ({ playerId, minutes: 0, pts: 0, reb: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, eff: 0 });
  const buildBox      = (existing: any) => [...players].sort(byJersey).map((p: any) => {
    const found = existing?.find((r: any) => r.playerId === p.id);
    return found || emptyRow(p.id);
  });

  const startNew = () => {
    setDraft({ date: "", opponent: "", home: true, result: "W", teamScore: "", opponentScore: "", seasonLeagueId: seasonLeagues[0]?.id ?? "", sourceUrl: "", youtubeUrl: "", boxScore: buildBox([]) });
    setEditId("new");
  };

  const startEdit = (g: any) => {
    setDraft({ ...g, date: g.date ?? g.playedOn?.slice(0, 10) ?? "", home: g.home ?? g.location === "home", sourceUrl: g.sourceUrl ?? "", youtubeUrl: g.youtubeUrl ?? "", boxScore: buildBox(g.boxScore) });
    setEditId(g.id);
  };

  const cancel   = () => { setEditId(null); setDraft({}); };
  const updGame  = (k: any, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));
  const updBox   = (playerId: any, k: any, v: any) => setDraft((d: any) => ({
    ...d, boxScore: d.boxScore.map((r: any) => r.playerId === playerId ? { ...r, [k]: parseFloat(v) || 0 } : r)
  }));

  const save = async () => {
    if (!draft.opponent?.trim()) { showToast("Opponent is required", "error"); return; }
    if (!draft.date?.trim())     { showToast("Date is required", "error"); return; }
    if (!draft.seasonLeagueId)   { showToast("League is required", "error"); return; }
    const isNew    = editId === "new";
    const boxScore = draft.boxScore.map((r: any) => {
      const fg2m = r.fg2m || 0, fg2a = r.fg2a || 0;
      const fg3m = r.fg3m || 0, fg3a = r.fg3a || 0;
      return {
        playerId: r.playerId,
        minutes:  r.minutes || 0,
        pts: r.pts || 0, reb: r.reb || 0, orb: r.orb || 0, drb: r.drb || 0,
        ast: r.ast || 0, stl: r.stl || 0, blk: r.blk || 0, tov: r.tov || 0,
        pf: r.pf || 0, fg2m, fg2a, fg3m, fg3a, fgm: fg2m + fg3m, fga: fg2a + fg3a,
        ftm: r.ftm || 0, fta: r.fta || 0,
      };
    });

    const res = await fetch("/api/admin/games", {
      method:  isNew ? "POST" : "PUT",
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
        sourceUrl:      draft.sourceUrl || null,
        youtubeUrl:     draft.youtubeUrl || null,
        boxScore,
      }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
    showToast(isNew ? "Game added!" : "Game saved!");
    cancel();
    loadData();
  };

  const deleteGame = async (g: any) => {
    const res = await fetch("/api/admin/games", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ gameId: g.id, seasonLeagueId: g.seasonLeagueId }),
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
        <F label="DATE"        value={draft.date}           onChange={(v: any) => updGame("date", v)}           placeholder="YYYY-MM-DD" />
        <F label="OPPONENT"    value={draft.opponent}       onChange={(v: any) => updGame("opponent", v)} />
        <Sel label="LEAGUE"    value={draft.seasonLeagueId || ""} onChange={(v: any) => updGame("seasonLeagueId", v)} options={leagueOptions} />
        <Sel label="HOME/AWAY" value={draft.home ? "home" : "away"} onChange={(v: any) => updGame("home", v === "home")} options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]} />
        <Sel label="RESULT"    value={draft.result}         onChange={(v: any) => updGame("result", v)}         options={[{ value: "W", label: "Win" }, { value: "L", label: "Loss" }, { value: "T", label: "Tie" }]} />
        <F label="OUR SCORE"   value={draft.teamScore}      onChange={(v: any) => updGame("teamScore", v)}      type="number" />
        <F label="OPP SCORE"   value={draft.opponentScore}  onChange={(v: any) => updGame("opponentScore", v)}  type="number" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <F label="OFFICIAL STATS URL" value={draft.sourceUrl} onChange={(v: any) => updGame("sourceUrl", v)} placeholder="https://..." />
        <F label="YOUTUBE REPLAY URL" value={draft.youtubeUrl} onChange={(v: any) => updGame("youtubeUrl", v)} placeholder="https://youtube.com/..." />
      </div>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, textTransform: "uppercase" }}>Box score</div>
      <BoxScoreTable players={players} rows={draft.boxScore || []} onUpdate={updBox} />
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Btn onClick={save}>SAVE GAME</Btn>
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
    <AdminLayout slug={slug} title="Games" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>Game results</div>
          {games.length > 0 && (
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
              {games.length} game{games.length !== 1 ? "s" : ""}
              {games.length >= 200 && " · showing latest 200"}
            </div>
          )}
        </div>
        <Btn onClick={startNew}>+ ADD GAME</Btn>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {games.length === 0 && editId !== "new" && (
            <div style={{ textAlign: "center", padding: "20px 0", color: C.textDim }}>No games recorded yet</div>
          )}
          {editId === "new" && gameForm}
          {[...games].sort((a, b) => new Date(b.date ?? b.playedOn).getTime() - new Date(a.date ?? a.playedOn).getTime()).map(g => (
            <div key={g.id}>
              {editId === g.id ? gameForm : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, background: g.result === "W" ? `${C.green}25` : `${C.red}25`, color: g.result === "W" ? C.green : C.redText, flexShrink: 0 }}>
                      {g.result}
                    </span>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 13, color: C.text }}>
                        {(g.home ?? g.location === "home") ? "vs" : "@"} {g.opponent}
                        <span style={{ fontWeight: 400, color: C.textDim, marginLeft: 8 }}>{g.score ?? `${g.teamScore}-${g.opponentScore}`}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.textDim }}>
                        {g.date ?? g.playedOn?.slice(0, 10)} · {seasonLeagues.find(sl => sl.id === g.seasonLeagueId)?.leagueName ?? ""}
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
          msg={`Delete game vs ${confirm.opponent} (${confirm.date ?? confirm.playedOn?.slice(0, 10)})?`}
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