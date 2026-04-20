/**
 * pages/admin/[slug]/games.js
 * Game list — view, edit, delete all games.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { AdminLayout, Spinner, LoginForm, BoxScoreTable, F, Sel, Btn, Confirm, useAdminAuth, byJersey, apiFetch } from "../../../lib/adminShared";
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

    const res = await apiFetch("/api/admin/games", {
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
    const res = await apiFetch("/api/admin/games", {
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
        <F label="DATE"        value={draft.date}           onChange={(v: any) => updGame("date", v)}           placeholder="YYYY-MM-DD" />
        <F label="OPPONENT"    value={draft.opponent}       onChange={(v: any) => updGame("opponent", v)} />
        <Sel label="LEAGUE"    value={draft.seasonLeagueId || ""} onChange={(v: any) => updGame("seasonLeagueId", v)} options={leagueOptions} />
        <Sel label="HOME/AWAY" value={draft.home ? "home" : "away"} onChange={(v: any) => updGame("home", v === "home")} options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]} />
        <Sel label="RESULT"    value={draft.result}         onChange={(v: any) => updGame("result", v)}         options={[{ value: "W", label: "Win" }, { value: "L", label: "Loss" }, { value: "T", label: "Tie" }]} />
        <F label="OUR SCORE"   value={draft.teamScore}      onChange={(v: any) => updGame("teamScore", v)}      type="number" />
        <F label="OPP SCORE"   value={draft.opponentScore}  onChange={(v: any) => updGame("opponentScore", v)}  type="number" />
      </div>
      <div className="grid grid-cols-2 gap-[10px] mb-3">
        <F label="OFFICIAL STATS URL" value={draft.sourceUrl} onChange={(v: any) => updGame("sourceUrl", v)} placeholder="https://..." />
        <F label="YOUTUBE REPLAY URL" value={draft.youtubeUrl} onChange={(v: any) => updGame("youtubeUrl", v)} placeholder="https://youtube.com/..." />
      </div>
      <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-2 pt-2 border-t border-ak-border uppercase">Box score</div>
      <BoxScoreTable players={players} rows={draft.boxScore || []} onUpdate={updBox} />
      <div className="flex gap-[10px] mt-3">
        <Btn onClick={save}>SAVE GAME</Btn>
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
    <AdminLayout slug={slug} title="Games" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <div className="mb-5 flex justify-between items-center">
        <div>
          <div className="text-[20px] font-black text-ak-text">Game results</div>
          {games.length > 0 && (
            <div className="text-[11px] text-ak-text-dim mt-0.5">
              {games.length} game{games.length !== 1 ? "s" : ""}
              {games.length >= 200 && " · showing latest 200"}
            </div>
          )}
        </div>
        <Btn onClick={startNew}>+ ADD GAME</Btn>
      </div>

      {loading ? (
        <div className="flex justify-center py-[60px]"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-[6px]">
          {games.length === 0 && editId !== "new" && (
            <div className="text-center py-5 text-ak-text-dim">No games recorded yet</div>
          )}
          {editId === "new" && gameForm}
          {[...games].sort((a, b) => new Date(b.date ?? b.playedOn).getTime() - new Date(a.date ?? a.playedOn).getTime()).map(g => (
            <div key={g.id}>
              {editId === g.id ? gameForm : (
                <div className="flex items-center justify-between py-[10px] px-[14px] rounded-[10px] border border-ak-border bg-ak-surface2">
                  <div className="flex items-center gap-[10px]">
                    <span className={[
                      "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0",
                      g.result === "W" ? "bg-[#4caf7d25] text-ak-green" : "bg-[#8b1a1a25] text-ak-red-text",
                    ].join(" ")}>
                      {g.result}
                    </span>
                    <div>
                      <div className="font-black text-[13px] text-ak-text">
                        {(g.home ?? g.location === "home") ? "vs" : "@"} {g.opponent}
                        <span className="font-normal text-ak-text-dim ml-2">{g.score ?? `${g.teamScore}–${g.opponentScore}`}</span>
                      </div>
                      <div className="text-[11px] text-ak-text-dim">
                        {g.date ?? g.playedOn?.slice(0, 10)} · {seasonLeagues.find(sl => sl.id === g.seasonLeagueId)?.leagueName ?? ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-[6px]">
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
