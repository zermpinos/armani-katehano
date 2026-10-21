import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { adminLayout, useAdminSession, Spinner, F, Sel, Btn, Confirm, TextArea, apiFetch } from "@/client/admin";
import type { Player, Game, SeasonLeague } from "@/client/admin";
import type { GetServerSidePropsContext } from "next";
import { getAdminPageProps } from "@/server/auth";
import { ReviewCards } from "@/client/admin/import/ReviewCards";
import { playedIn } from "@/client/admin/import/line-assign";
import { emptyDraft, gameToDraft, toGameBody, validateGameDraft, type GameDraft } from "@/client/admin/games/game-draft";

type EditData = { game: Game | null; players: Player[]; seasonLeagues: SeasonLeague[] };
type Load     = "loading" | "ready" | "missing" | "failed";

const ROUNDS = [
  { value: "regular",      label: "Regular Season" },
  { value: "quarterfinal", label: "Quarterfinal"   },
  { value: "semifinal",    label: "Semifinal"      },
  { value: "final",        label: "Final"          },
];

const RESULTS = [
  { value: "W", label: "Win"  },
  { value: "L", label: "Loss" },
  { value: "T", label: "Tie"  },
];

const jsonInit = (method: string, body: unknown) =>
  ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function GameEditPage() {
  const router = useRouter();
  const { slug, setToast } = useAdminSession();
  const idParam = typeof router.query.id === "string" ? router.query.id : null;
  const isNew = idParam === "new";

  const [players,       setPlayers]       = useState<Player[]>([]);
  const [seasonLeagues, setSeasonLeagues] = useState<SeasonLeague[]>([]);
  const [draft,         setDraft]         = useState<GameDraft | null>(null);
  // Fixed at load: a card that changed lists while its MIN was typed would remount and drop the keystroke.
  const [playedIds,     setPlayedIds]     = useState<Set<string>>(new Set());
  const [load,          setLoad]          = useState<Load>("loading");
  const [attempt,       setAttempt]       = useState(0);
  const [saving,        setSaving]        = useState(false);
  const [askDelete,     setAskDelete]     = useState(false);
  const [askBroadcast,  setAskBroadcast]  = useState(false);
  const [broadcasting,  setBroadcasting]  = useState(false);

  useEffect(() => {
    if (!idParam) return;
    let cancelled = false;
    void (async () => {
      const res  = await apiFetch(`/api/admin/data?gameId=${encodeURIComponent(idParam)}`).catch(() => null);
      const data = res?.ok ? ((await res.json().catch(() => null)) as EditData | null) : null;
      if (cancelled) return;
      if (!data) { setLoad(res?.status === 404 || res?.status === 400 ? "missing" : "failed"); return; }
      const next = data.game
        ? gameToDraft(data.game, data.players)
        : emptyDraft(data.seasonLeagues[0]?.id ?? "", data.players);
      setPlayers(data.players);
      setSeasonLeagues(data.seasonLeagues);
      setDraft(next);
      setPlayedIds(playedIn(next.boxScore));
      setLoad("ready");
    })();
    return () => { cancelled = true; };
  }, [idParam, attempt]);

  const upd = <K extends keyof GameDraft>(k: K, v: GameDraft[K]) => setDraft(d => (d ? { ...d, [k]: v } : d));

  const updBox = (playerId: string, key: string, value: string) => setDraft(d => d && {
    ...d,
    boxScore: d.boxScore.map(r => (r.playerId === playerId ? { ...r, [key]: parseFloat(value) || 0 } : r)),
  });

  const save = async () => {
    if (!draft || !idParam) return;
    const invalid = validateGameDraft(draft);
    if (invalid) { setToast({ msg: invalid, type: "error" }); return; }
    setSaving(true);
    const res = await apiFetch("/api/admin/games", jsonInit(isNew ? "POST" : "PUT", toGameBody(draft, isNew ? null : idParam))).catch(() => null);
    if (!res?.ok) {
      const body: { error?: string } = res ? await res.json().catch(() => ({})) : {};
      setToast({ msg: body.error ?? (res ? "Save failed" : "Network error. Check the connection and try again."), type: "error" });
      setSaving(false);
      return;
    }
    router.push(`/admin/${slug}/games?saved=${isNew ? "created" : "updated"}`);
  };

  const handleDelete = async () => {
    if (isNew || !idParam || !draft) return;
    setSaving(true);
    const res = await apiFetch("/api/admin/games", jsonInit("DELETE", { gameId: idParam, seasonLeagueId: draft.seasonLeagueId }));
    if (!res.ok) {
      const body = await res.json();
      setToast({ msg: body.error ?? "Delete failed", type: "error" });
      setSaving(false);
      setAskDelete(false);
      return;
    }
    router.push(`/admin/${slug}/games?saved=deleted`);
  };

  const handleBroadcast = async () => {
    if (isNew || !idParam) return;
    setBroadcasting(true);
    const res = await apiFetch("/api/admin/broadcast-game", jsonInit("POST", { gameId: idParam }));
    const body = await res.json();
    setBroadcasting(false);
    setAskBroadcast(false);
    if (res.status === 409) {
      const when = body.broadcastedAt ? new Date(body.broadcastedAt).toLocaleDateString() : "earlier";
      setToast({ msg: `Already broadcast on ${when}`, type: "error" });
      return;
    }
    if (!res.ok) {
      setToast({ msg: body.error ?? "Broadcast failed", type: "error" });
      return;
    }
    setToast({ msg: `Recap sent to ${body.recipientCount} subscribers.`, type: "success" });
  };

  const title = isNew ? "Add game" : "Edit game";
  const leagueOptions = seasonLeagues.map(sl => ({ value: sl.id, label: `${sl.leagueName} · ${sl.seasonName}` }));

  return (
    <>
      <Link
        href={`/admin/${slug}/games`}
        className="inline-flex items-center gap-1 text-[11px] font-black tracking-[0.12em] uppercase text-ak-text-dim mb-3"
      >
        ← Games
      </Link>
      <h1 className="text-[22px] md:text-[28px] font-black text-ak-text mb-6">{title}</h1>

      {load === "loading" ? (
        <div className="flex justify-center py-[60px]"><Spinner /></div>
      ) : load === "failed" ? (
        <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
          <div className="mb-4 text-[12px] text-ak-text-dim">Could not load the game.</div>
          <Btn size="sm" onClick={() => { setLoad("loading"); setAttempt(a => a + 1); }}>Retry</Btn>
        </div>
      ) : load === "missing" || !draft ? (
        <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
          <div className="text-[15px] font-black text-ak-text mb-1">Game not found</div>
          <Link href={`/admin/${slug}/games`} className="text-[11px] font-black tracking-[0.12em] uppercase text-ak-red-text">
            ← Back to games
          </Link>
        </div>
      ) : (
        <>
          <Panel label="Match">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <F label="DATE" type="date" value={draft.date} onChange={v => upd("date", v)} />
              <F label="OPPONENT" value={draft.opponent} onChange={v => upd("opponent", v)} />
              <Sel label="LEAGUE" value={draft.seasonLeagueId} onChange={v => upd("seasonLeagueId", v)} options={leagueOptions} />
              <Sel
                label="HOME / AWAY"
                value={draft.home ? "home" : "away"}
                onChange={v => upd("home", v === "home")}
                options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]}
              />
              <Sel label="RESULT" value={draft.result} onChange={v => upd("result", v as GameDraft["result"])} options={RESULTS} />
              <Sel label="ROUND" value={draft.round} onChange={v => upd("round", v)} options={ROUNDS} />
              <F label="OUR SCORE" value={draft.teamScore} onChange={v => upd("teamScore", v)} type="number" />
              <F label="OPP SCORE" value={draft.opponentScore} onChange={v => upd("opponentScore", v)} type="number" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F label="OFFICIAL STATS URL" value={draft.sourceUrl} onChange={v => upd("sourceUrl", v)} placeholder="https://..." />
              <F label="YOUTUBE REPLAY URL" value={draft.youtubeUrl} onChange={v => upd("youtubeUrl", v)} placeholder="https://youtube.com/..." />
            </div>
            <div className="mt-4">
              <TextArea label="NOTES" value={draft.notes} onChange={v => upd("notes", v)} rows={3} maxLength={1000} />
            </div>
          </Panel>

          <Panel label="Box score">
            <ReviewCards players={players} rows={draft.boxScore} playedIds={playedIds} onUpdate={updBox} />
          </Panel>

          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-ak-base border-t border-ak-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Btn onClick={save} disabled={saving}>{saving ? "SAVING..." : isNew ? "ADD GAME" : "SAVE CHANGES"}</Btn>
              <Link
                href={`/admin/${slug}/games`}
                className="inline-flex min-h-[44px] items-center py-[9px] px-[18px] text-[13px] font-black tracking-[0.12em] rounded-lg border border-ak-border2 text-ak-text-sub"
              >
                CANCEL
              </Link>
            </div>
            {!isNew && (
              <div className="flex items-center gap-2 flex-wrap">
                <Btn variant="ghost" onClick={() => setAskBroadcast(true)} disabled={broadcasting || saving}>
                  {broadcasting ? "SENDING..." : "BROADCAST"}
                </Btn>
                <Btn variant="danger" onClick={() => setAskDelete(true)} disabled={saving}>
                  DELETE
                </Btn>
              </div>
            )}
          </div>
        </>
      )}

      {askDelete && draft && (
        <Confirm
          msg={`Delete game vs ${draft.opponent} (${draft.date})? Box score and stats are removed too.`}
          onConfirm={handleDelete}
          onCancel={() => setAskDelete(false)}
        />
      )}

      {askBroadcast && draft && (
        <Confirm
          msg={`Send game recap email to all confirmed subscribers for ${draft.home ? "vs" : "@"} ${draft.opponent}? This can only be done once per game.`}
          onConfirm={handleBroadcast}
          onCancel={() => setAskBroadcast(false)}
        />
      )}
    </>
  );
}

GameEditPage.getLayout = adminLayout("Game");

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ak-border bg-ak-surface p-4 md:p-5 mb-5">
      <div className="text-[10px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-3">{label}</div>
      {children}
    </section>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return getAdminPageProps(ctx);
}
