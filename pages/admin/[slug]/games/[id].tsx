import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  AdminLayout, Spinner, PasskeyLoginForm, BoxScoreTable, F, Sel, Btn, Confirm,
  useAdminAuth, byJersey, apiFetch,
} from "@/client/admin";
import type { Player, Game, SeasonLeague, BoxScoreRow } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";
import { fmt } from "@/domain/players/format";

type Draft = {
  date:           string;
  opponent:       string;
  home:           boolean;
  result:         "W" | "L" | "T";
  round:          string;
  teamScore:      string;
  opponentScore:  string;
  seasonLeagueId: string;
  sourceUrl:      string;
  youtubeUrl:     string;
  boxScore:       BoxScoreRow[];
};

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

function emptyRow(playerId: string): BoxScoreRow {
  return {
    playerId, minutes: 0, pts: 0, reb: 0, orb: 0, drb: 0,
    ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
    fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0,
    ftm: 0, fta: 0, eff: 0,
  };
}

function buildBoxFromPlayers(players: Player[], existing: BoxScoreRow[] | undefined): BoxScoreRow[] {
  return [...players].sort(byJersey).map(p => {
    const found = existing?.find(r => r.playerId === p.id);
    return found ?? emptyRow(p.id);
  });
}

function gameToDraft(g: Game, players: Player[]): Draft {
  return {
    date:           g.date ?? g.playedOn?.slice(0, 10) ?? "",
    opponent:       g.opponent,
    home:           g.home ?? g.location === "home",
    result:         g.result,
    round:          (g as { round?: string }).round ?? "regular",
    teamScore:      String(g.teamScore ?? ""),
    opponentScore:  String(g.opponentScore ?? ""),
    seasonLeagueId: g.seasonLeagueId,
    sourceUrl:      g.sourceUrl  ?? "",
    youtubeUrl:     g.youtubeUrl ?? "",
    boxScore:       buildBoxFromPlayers(players, g.boxScore),
  };
}

export default function GameEditPage({
  validSlug, showFallback, noPasskeys,
}: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;
  const idParam = typeof router.query.id === "string" ? router.query.id : null;
  const isNew = idParam === "new";

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [players,       setPlayers]       = useState<Player[]>([]);
  const [seasonLeagues, setSeasonLeagues] = useState<SeasonLeague[]>([]);
  const [draft,         setDraft]         = useState<Draft | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [notFound,      setNotFound]      = useState(false);
  const [askDelete,     setAskDelete]     = useState(false);
  const [askBroadcast,  setAskBroadcast]  = useState(false);
  const [broadcasting,  setBroadcasting]  = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; type?: string } | null>(null);

  useEffect(() => {
    if (!router.isReady || !authed || !slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/data");
        if (!res.ok) { if (!cancelled) { setNotFound(true); setLoading(false); } return; }
        const d = await res.json();
        if (cancelled) return;
        const ps: Player[] = d.players ?? [];
        const sls: SeasonLeague[] = d.seasonLeagues ?? [];
        setPlayers(ps);
        setSeasonLeagues(sls);
        if (isNew) {
          setDraft({
            date: "", opponent: "", home: true, result: "W", round: "regular",
            teamScore: "", opponentScore: "",
            seasonLeagueId: sls[0]?.id ?? "",
            sourceUrl: "", youtubeUrl: "",
            boxScore: buildBoxFromPlayers(ps, undefined),
          });
        } else if (idParam) {
          const game = (d.games as Game[] | undefined)?.find(g => g.id === idParam);
          if (!game) { setNotFound(true); setLoading(false); return; }
          setDraft(gameToDraft(game, ps));
        }
        setLoading(false);
      } catch {
        if (!cancelled) { setNotFound(true); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [router.isReady, authed, slug, idParam, isNew]);

  const upd = (k: keyof Draft, v: unknown) => setDraft(d => d ? ({ ...d, [k]: v } as Draft) : d);

  const updBox = (playerId: string, key: string, value: string) => setDraft(d => {
    if (!d) return d;
    const next = parseFloat(value) || 0;
    // Mirror "min" (BoxScoreTable column key) into "minutes" so the save handler picks it up.
    return {
      ...d,
      boxScore: d.boxScore.map(r => r.playerId === playerId
        ? {
            ...r,
            [key]: next,
            ...(key === "min" ? { minutes: next } : null),
            ...(key === "minutes" ? { min: next } : null),
          }
        : r),
    };
  });

  const save = async () => {
    if (!draft) return;
    if (!draft.opponent.trim())  { setToast({ msg: "Opponent is required", type: "error" }); return; }
    if (!draft.date.trim())      { setToast({ msg: "Date is required", type: "error" }); return; }
    if (!draft.seasonLeagueId)   { setToast({ msg: "League is required", type: "error" }); return; }

    const boxScore = draft.boxScore.map(r => {
      const fg2m = r.fg2m || 0, fg2a = r.fg2a || 0;
      const fg3m = r.fg3m || 0, fg3a = r.fg3a || 0;
      return {
        playerId: r.playerId,
        minutes:  r.minutes ?? r.min ?? 0,
        pts: r.pts || 0, reb: r.reb || 0, orb: r.orb || 0, drb: r.drb || 0,
        ast: r.ast || 0, stl: r.stl || 0, blk: r.blk || 0, tov: r.tov || 0,
        pf: r.pf || 0, fg2m, fg2a, fg3m, fg3a, fgm: fg2m + fg3m, fga: fg2a + fg3a,
        ftm: r.ftm || 0, fta: r.fta || 0,
      };
    });

    setSaving(true);
    const res = await apiFetch("/api/admin/games", {
      method:  isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId:         isNew ? undefined : idParam,
        seasonLeagueId: draft.seasonLeagueId,
        opponent:       draft.opponent,
        location:       draft.home ? "home" : "away",
        teamScore:      Number(draft.teamScore) || 0,
        opponentScore:  Number(draft.opponentScore) || 0,
        result:         draft.result,
        round:          draft.round,
        playedOn:       draft.date,
        sourceUrl:      draft.sourceUrl || null,
        youtubeUrl:     draft.youtubeUrl || null,
        boxScore,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setToast({ msg: body.error ?? "Save failed", type: "error" });
      setSaving(false);
      return;
    }
    router.push(`/admin/${slug}/games?saved=${isNew ? "created" : "updated"}`);
  };

  const handleDelete = async () => {
    if (isNew || !idParam || !draft) return;
    setSaving(true);
    const res = await apiFetch("/api/admin/games", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ gameId: idParam, seasonLeagueId: draft.seasonLeagueId }),
    });
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
    const res = await apiFetch("/api/admin/broadcast-game", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ gameId: idParam }),
    });
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

  if (!validSlug) return null;
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base"><Spinner /></div>
  );
  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base p-4">
      <PasskeyLoginForm onPasskeyLogin={handlePasskeyLogin} onFallbackLogin={handleLogin} loginError={loginError} showFallback={showFallback} noPasskeys={noPasskeys} />
    </div>
  );

  const title = isNew ? "Add game" : "Edit game";
  const leagueOptions = seasonLeagues.map(sl => ({ value: sl.id, label: sl.leagueName }));

  return (
    <AdminLayout slug={slug} title={title} toast={toast} setToast={setToast} onLogout={handleLogout}>
      <Link
        href={`/admin/${slug}/games`}
        className="inline-flex items-center gap-1 text-[11px] font-black tracking-[0.12em] uppercase text-ak-text-dim mb-3"
      >
        ← Games
      </Link>
      <h1 className="text-[22px] md:text-[28px] font-black text-ak-text mb-6">{title}</h1>

      {loading ? (
        <div className="flex justify-center py-[60px]"><Spinner /></div>
      ) : notFound || !draft ? (
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
              <F label="DATE" value={draft.date} onChange={v => upd("date", v)} placeholder="YYYY-MM-DD" />
              <F label="OPPONENT" value={draft.opponent} onChange={v => upd("opponent", v)} />
              <Sel
                label="LEAGUE"
                value={draft.seasonLeagueId}
                onChange={v => upd("seasonLeagueId", v)}
                options={leagueOptions}
              />
              <Sel
                label="HOME / AWAY"
                value={draft.home ? "home" : "away"}
                onChange={v => upd("home", v === "home")}
                options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]}
              />
              <Sel label="RESULT" value={draft.result} onChange={v => upd("result", v)} options={RESULTS} />
              <Sel label="ROUND" value={draft.round} onChange={v => upd("round", v)} options={ROUNDS} />
              <F label="OUR SCORE" value={draft.teamScore} onChange={v => upd("teamScore", v)} type="number" />
              <F label="OPP SCORE" value={draft.opponentScore} onChange={v => upd("opponentScore", v)} type="number" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F label="OFFICIAL STATS URL" value={draft.sourceUrl} onChange={v => upd("sourceUrl", v)} placeholder="https://..." />
              <F label="YOUTUBE REPLAY URL" value={draft.youtubeUrl} onChange={v => upd("youtubeUrl", v)} placeholder="https://youtube.com/..." />
            </div>
          </Panel>

          <Panel label="Box score">
            <div className="hidden md:block">
              <BoxScoreTable players={players} rows={draft.boxScore} onUpdate={updBox} />
            </div>
            <div className="md:hidden flex flex-col gap-3">
              {draft.boxScore.map(row => (
                <PlayerBoxCard
                  key={row.playerId}
                  player={players.find(p => p.id === row.playerId)}
                  row={row}
                  onUpdate={updBox}
                />
              ))}
            </div>
          </Panel>

          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-ak-base border-t border-ak-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Btn onClick={save} disabled={saving}>{saving ? "SAVING..." : isNew ? "ADD GAME" : "SAVE CHANGES"}</Btn>
              <Link
                href={`/admin/${slug}/games`}
                className="py-[9px] px-[18px] text-[13px] font-black tracking-[0.12em] rounded-lg border border-ak-border2 text-ak-text-sub"
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
    </AdminLayout>
  );
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ak-border bg-ak-surface p-4 md:p-5 mb-5">
      <div className="text-[10px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-3">{label}</div>
      {children}
    </section>
  );
}

const GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: "Scoring",   keys: ["min", "pts", "eff"] },
  { label: "Shooting",  keys: ["fg2m", "fg2a", "fg3m", "fg3a", "ftm", "fta"] },
  { label: "Rebounds",  keys: ["orb", "drb"] },
  { label: "Playmaking",keys: ["ast", "stl", "blk", "tov", "pf"] },
];

const KEY_LABELS: Record<string, string> = {
  min: "MIN", pts: "PTS", eff: "EFF",
  fg2m: "2PM", fg2a: "2PA", fg3m: "3PM", fg3a: "3PA", ftm: "FTM", fta: "FTA",
  orb: "ORB", drb: "DRB",
  ast: "AST", stl: "STL", blk: "BLK", tov: "TOV", pf: "PF",
};

function PlayerBoxCard({ player, row, onUpdate }: {
  player: Player | undefined;
  row: BoxScoreRow;
  onUpdate: (playerId: string, key: string, value: string) => void;
}) {
  const rowData = row as unknown as Record<string, number | undefined>;
  const minutes = rowData["minutes"] ?? rowData["min"] ?? 0;
  const played = minutes > 0;
  return (
    <article className={[
      "rounded-[9px] border p-3",
      played ? "border-[#4caf7d40] bg-[#4caf7d08]" : "border-ak-border bg-ak-base",
    ].join(" ")}>
      <header className="flex items-baseline gap-2 mb-2">
        <span className="text-[12px] font-black text-ak-red-text tracking-[0.06em]">
          #{player?.number ?? "?"}
        </span>
        <span className={[
          "text-[13px] font-black truncate",
          played ? "text-ak-green" : "text-ak-text",
        ].join(" ")}>
          {player ? fmt(player.name) : "-"}
        </span>
      </header>
      <div className="flex flex-col gap-2">
        {GROUPS.map(group => (
          <div key={group.label}>
            <div className="text-[9px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-1">
              {group.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.keys.map(k => (
                <StatInput
                  key={k}
                  label={Reflect.get(KEY_LABELS, k) as string}
                  value={(Reflect.get(rowData, k) as number | undefined) ?? 0}
                  highlight={k === "eff"}
                  onChange={v => onUpdate(row.playerId, k, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function StatInput({ label, value, onChange, highlight }: {
  label: string; value: number; onChange: (v: string) => void; highlight?: boolean;
}) {
  return (
    <label className="flex flex-col items-center gap-[2px]">
      <span className="text-[9px] font-black tracking-[0.1em] text-ak-text-dim">{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={[
          "w-[52px] text-center text-[12px] py-[4px] rounded border bg-transparent font-sans outline-none",
          highlight ? "border-[#8b1a1a55] text-ak-red-text" : "border-ak-border text-ak-text-sub",
        ].join(" ")}
      />
    </label>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
