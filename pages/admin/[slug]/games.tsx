/**
 * pages/admin/[slug]/games.js
 * Game list - view, edit, delete all games.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { AdminLayout, Spinner, PasskeyLoginForm, BoxScoreTable, F, Sel, Btn, Confirm, useAdminAuth, byJersey, apiFetch } from "@/client/admin";
import type { Player, Game, SeasonLeague, BoxScoreRow } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";

type GameDraft = {
  date: string;
  opponent: string;
  home: boolean;
  result: string;
  round: string;
  teamScore: string | number;
  opponentScore: string | number;
  seasonLeagueId: string;
  sourceUrl: string;
  youtubeUrl: string;
  boxScore: BoxScoreRow[];
};

export default function GamesPage({ validSlug, showFallback, noPasskeys }: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  // A-02 fix: derive slug from the Next.js router, not window.location.
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: checking, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [players,       setPlayers]       = useState<Player[]>([]);
  const [games,         setGames]         = useState<Game[]>([]);
  const [seasonLeagues, setSeasonLeagues] = useState<SeasonLeague[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [draft,   setDraft]   = useState<Partial<GameDraft>>({});
  const [confirm, setConfirm] = useState<Game | null>(null);

  const showToast = (msg: string, type = "success") => setToast({ msg, type });

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
  const emptyRow      = (playerId: string): BoxScoreRow => ({ playerId, minutes: 0, pts: 0, reb: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, eff: 0 });
  const buildBox      = (existing: BoxScoreRow[] | undefined): BoxScoreRow[] => [...players].sort(byJersey).map(p => {
    const found = existing?.find(r => r.playerId === p.id);
    return found ?? emptyRow(p.id);
  });

  const startNew = () => {
    setDraft({ date: "", opponent: "", home: true, result: "W", round: "regular", teamScore: "", opponentScore: "", seasonLeagueId: seasonLeagues[0]?.id ?? "", sourceUrl: "", youtubeUrl: "", boxScore: buildBox([]) });
    setEditId("new");
  };

  const startEdit = (g: Game) => {
    setDraft({
      ...g,
      date:       g.date ?? g.playedOn?.slice(0, 10) ?? "",
      home:       g.home ?? g.location === "home",
      round:      (g as any).round ?? "regular",
      sourceUrl:  g.sourceUrl  ?? "",
      youtubeUrl: g.youtubeUrl ?? "",
      boxScore:   buildBox(g.boxScore),
    });
    setEditId(g.id);
  };

  const cancel   = () => { setEditId(null); setDraft({}); };
  const updGame  = (k: string, v: unknown) => setDraft(d => ({ ...d, [k]: v } as Partial<GameDraft>));
  const updBox   = (playerId: string, k: string, v: string) => setDraft(d => ({
    ...d, boxScore: (d.boxScore ?? []).map(r => r.playerId === playerId ? { ...r, [k]: parseFloat(v) || 0 } : r)
  } as Partial<GameDraft>));

  const save = async () => {
    if (!draft.opponent?.trim()) { showToast("Opponent is required", "error"); return; }
    if (!draft.date?.trim())     { showToast("Date is required", "error"); return; }
    if (!draft.seasonLeagueId)   { showToast("League is required", "error"); return; }
    const isNew    = editId === "new";
    const boxScore = (draft.boxScore ?? []).map(r => {
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
        round:          draft.round ?? "regular",
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

  const broadcastGame = async (g: Game) => {
    if (!window.confirm(`Send game recap email to all subscribers for ${(g.home ?? g.location === "home") ? "vs" : "@"} ${g.opponent}?`)) return;
    const res = await apiFetch("/api/admin/broadcast-game", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ gameId: g.id }),
    });
    const d = await res.json();
    if (res.status === 409) { showToast("Already broadcast on " + new Date(d.broadcastedAt).toLocaleDateString(), "error"); return; }
    if (!res.ok) { showToast(d.error ?? "Broadcast failed", "error"); return; }
    showToast(`Recap sent to ${d.recipientCount} subscribers!`);
  };

  const deleteGame = async (g: Game) => {
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
        <F label="DATE"        value={draft.date ?? ""}          onChange={v => updGame("date", v)}           placeholder="YYYY-MM-DD" />
        <F label="OPPONENT"    value={draft.opponent ?? ""}      onChange={v => updGame("opponent", v)} />
        <Sel label="LEAGUE"    value={draft.seasonLeagueId ?? ""} onChange={v => updGame("seasonLeagueId", v)} options={leagueOptions} />
        <Sel label="HOME/AWAY" value={draft.home ? "home" : "away"} onChange={v => updGame("home", v === "home")} options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]} />
        <Sel label="RESULT"    value={draft.result ?? "W"}       onChange={v => updGame("result", v)}         options={[{ value: "W", label: "Win" }, { value: "L", label: "Loss" }, { value: "T", label: "Tie" }]} />
        <Sel
          label="ROUND"
          value={draft.round ?? "regular"}
          onChange={v => updGame("round", v)}
          options={[
            { value: "regular",      label: "Regular Season" },
            { value: "quarterfinal", label: "Quarterfinal"   },
            { value: "semifinal",    label: "Semifinal"      },
            { value: "final",        label: "Final"          },
          ]}
        />
        <F label="OUR SCORE"   value={draft.teamScore ?? ""}     onChange={v => updGame("teamScore", v)}      type="number" />
        <F label="OPP SCORE"   value={draft.opponentScore ?? ""} onChange={v => updGame("opponentScore", v)}  type="number" />
      </div>
      <div className="grid grid-cols-2 gap-[10px] mb-3">
        <F label="OFFICIAL STATS URL" value={draft.sourceUrl ?? ""} onChange={v => updGame("sourceUrl", v)} placeholder="https://..." />
        <F label="YOUTUBE REPLAY URL" value={draft.youtubeUrl ?? ""} onChange={v => updGame("youtubeUrl", v)} placeholder="https://youtube.com/..." />
      </div>
      <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-2 pt-2 border-t border-ak-border uppercase">Box score</div>
      <BoxScoreTable players={players} rows={draft.boxScore ?? []} onUpdate={updBox} />
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
      <PasskeyLoginForm onPasskeyLogin={handlePasskeyLogin} onFallbackLogin={handleLogin} loginError={loginError} showFallback={showFallback} noPasskeys={noPasskeys} />
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
          {[...games].sort((a, b) => new Date(b.date ?? b.playedOn ?? "").getTime() - new Date(a.date ?? a.playedOn ?? "").getTime()).map(g => (
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
                        <span className="font-normal text-ak-text-dim ml-2">{g.score ?? `${g.teamScore}-${g.opponentScore}`}</span>
                      </div>
                      <div className="text-[11px] text-ak-text-dim">
                        {g.date ?? g.playedOn?.slice(0, 10)} · {seasonLeagues.find(sl => sl.id === g.seasonLeagueId)?.leagueName ?? ""}
                        {(g as any).round && (g as any).round !== "regular" && (
                          <span className="ml-2 text-ak-red-text font-bold">
                            {(g as any).round === "quarterfinal" ? "Quarterfinal" : (g as any).round === "semifinal" ? "Semifinal" : "Final"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-[6px]">
                    <Btn size="sm" variant="ghost" onClick={() => broadcastGame(g)}>BROADCAST</Btn>
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

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
