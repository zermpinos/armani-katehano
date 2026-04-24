/**
 * pages/admin/[slug]/import.js
 * Admin enters a game URL -> server scrapes it -> admin reviews -> saves.
 * Also accepts an optional YouTube video URL.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { AdminLayout, BoxScoreTable, F, Sel, Btn, Spinner, LoginForm, byJersey, useAdminAuth, apiFetch } from "@/client/admin";
import type { Player, SeasonLeague, BoxScoreRow } from "@/client/admin";
import { validateAdminSlug } from '@/server/auth';
import { parseGreekDate, parseMinutes, detectLeagueSlug } from '@/domain/calendar/greek-date';

type ImportDraft = {
  date: string;
  opponent: string;
  home: boolean;
  result: "W" | "L" | "T";
  teamScore: number;
  opponentScore: number;
  seasonLeagueId: string;
  sourceUrl: string | null;
  boxScore: BoxScoreRow[];
};

export default function ImportPage({ validSlug }: { validSlug: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: checking, loginError, handleLogin, handleLogout } = useAdminAuth(slug);

  const [players,       setPlayers]       = useState<Player[]>([]);
  const [seasonLeagues, setSeasonLeagues] = useState<SeasonLeague[]>([]);
  const [dataLoading,   setDataLoading]   = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(null);

  const [gameUrl,    setGameUrl]    = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [fetching,   setFetching]   = useState(false);
  const [phase,      setPhase]      = useState("idle");
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [highlights, setHighlights] = useState<Record<string, boolean>>({});
  const [warnings,   setWarnings]   = useState<string[]>([]);
  const [error,      setError]      = useState("");
  const [gameState,  setGameState]  = useState<{ state: string; reason: string } | null>(null);

  const showToast = (msg: string, type = "success") => setToast({ msg, type });

  const loadBase = async () => {
    setDataLoading(true);
    try {
      const [pRes, slRes] = await Promise.all([
        fetch("/api/admin/players"),
        fetch("/api/admin/season-leagues"),
      ]);
      if (pRes.ok)  { const d = await pRes.json();  setPlayers(d.players ?? []); }
      if (slRes.ok) { const d = await slRes.json(); setSeasonLeagues(d.seasonLeagues ?? []); }
    } finally { setDataLoading(false); }
  };

  useEffect(() => { if (authed) loadBase(); }, [authed]);

  // ── buildDraft -- maps scraper JSON to the review UI ──────────────────────
  const buildDraft = (data: Record<string, unknown>) => {
    const { game, teams, url: sourceUrl } = data as {
      game: { homeTeam: string; awayTeam: string; date: string; finalScore: { home: number; away: number } };
      teams: { name: string; players: Record<string, unknown>[] }[];
      url: string;
    };

    const akTeam = teams.find(t =>
      t.name.toUpperCase().includes("ARMANI") ||
      t.name.toUpperCase().includes("KATEHANO")
    );
    if (!akTeam) throw new Error("ARMANI KATEHANO team not found in scraped data");

    const isHome      = game.homeTeam.toUpperCase().includes("ARMANI") ||
                        game.homeTeam.toUpperCase().includes("KATEHANO");
    const akScore     = isHome ? game.finalScore.home  : game.finalScore.away;
    const oppScore    = isHome ? game.finalScore.away  : game.finalScore.home;
    const oppTeamName = isHome ? game.awayTeam         : game.homeTeam;
    const result      = akScore > oppScore ? "W" : akScore < oppScore ? "L" : "T" as const;
    const parsedDate  = parseGreekDate(game.date);
    const date        = parsedDate ? parsedDate.toISOString().slice(0, 10) : "";
    const leagueSlug  = detectLeagueSlug(sourceUrl);

    const matchedSL = seasonLeagues.find(sl => sl.leagueSlug === leagueSlug)
                   ?? seasonLeagues[0];

    const boxScore: BoxScoreRow[] = [...players].sort(byJersey).map(dbPlayer => {
      const scraped = akTeam.players.find((p: Record<string, unknown>) => p["#"] === Number(dbPlayer.number));
      const mins    = scraped ? parseMinutes(scraped.MIN as string) : 0;

      if (!scraped || mins === 0) {
        return {
          playerId: dbPlayer.id, minutes: 0, pts: 0, reb: 0, orb: 0, drb: 0,
          ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
          fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0,
          ftm: 0, fta: 0, eff: 0,
        };
      }

      const fg2m = (scraped["2PTS"] as { made?: number })?.made      ?? 0;
      const fg2a = (scraped["2PTS"] as { attempted?: number })?.attempted ?? 0;
      const fg3m = (scraped["3PTS"] as { made?: number })?.made      ?? 0;
      const fg3a = (scraped["3PTS"] as { attempted?: number })?.attempted ?? 0;

      return {
        playerId: dbPlayer.id,
        minutes:  mins,
        pts:  scraped.PTS  as number ?? 0,
        reb:  scraped.REB  as number ?? 0,
        orb:  scraped.OREB as number ?? 0,
        drb:  scraped.DREB as number ?? 0,
        ast:  scraped.AST  as number ?? 0,
        stl:  scraped.STL  as number ?? 0,
        blk:  scraped.BLK  as number ?? 0,
        tov:  scraped.TO   as number ?? 0,
        pf:   scraped.PF   as number ?? 0,
        fg2m, fg2a, fg3m, fg3a,
        fgm:  fg2m + fg3m,
        fga:  fg2a + fg3a,
        ftm:  (scraped.FT as { made?: number })?.made      ?? 0,
        fta:  (scraped.FT as { attempted?: number })?.attempted ?? 0,
        eff:  scraped.EF   as number ?? 0,
      };
    });

    const hl: Record<string, boolean> = {};
    akTeam.players.forEach((p: Record<string, unknown>) => {
      if (parseMinutes(p.MIN as string) > 0) {
        const dbPlayer = players.find(pl => Number(pl.number) === p["#"]);
        if (dbPlayer) hl[dbPlayer.id] = true;
      }
    });

    const warns: string[] = [];
    akTeam.players.filter((p: Record<string, unknown>) => parseMinutes(p.MIN as string) > 0).forEach((p: Record<string, unknown>) => {
      const fg2m = (p["2PTS"] as { made?: number })?.made ?? 0;
      const fg3m = (p["3PTS"] as { made?: number })?.made ?? 0;
      const ftm  = (p.FT as { made?: number })?.made ?? 0;
      const expPts = fg2m * 2 + fg3m * 3 + ftm;
      if ((p.PTS as number ?? 0) !== expPts)
        warns.push(`#${p["#"]} ${p.Players}: pts=${p.PTS}, expected ${expPts}`);
    });

    return {
      draft: {
        date,
        opponent:       oppTeamName,
        home:           isHome,
        result,
        teamScore:      akScore,
        opponentScore:  oppScore,
        seasonLeagueId: matchedSL?.id ?? "",
        sourceUrl:      sourceUrl ?? null,
        boxScore,
      } satisfies ImportDraft,
      highlights: hl,
      warnings:   warns,
    };
  };

  // ── fetchAndReview -- calls the server-side scraper ───────────────────────
  const fetchAndReview = async () => {
    setError("");
    setFetching(true);
    try {
      const res = await apiFetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: gameUrl.trim() }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || "Scrape failed"); return; }

      const { draft, highlights, warnings } = buildDraft(body.data);
      setDraft(draft); setHighlights(highlights); setWarnings(warnings);
      setGameState(body.gameState ?? null);
      setPhase("review");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFetching(false);
    }
  };

  const updDraft = (k: string, v: unknown) => setDraft(d => d ? ({ ...d, [k]: v } as ImportDraft) : d);
  const updBox   = (playerId: string, k: string, v: string) => setDraft(d => d ? ({
    ...d, boxScore: d.boxScore.map(r => r.playerId === playerId ? { ...r, [k]: parseFloat(v) || 0 } : r)
  } as ImportDraft) : d);

  const save = async () => {
    if (!draft) return;
    setPhase("saving");
    const boxScore = draft.boxScore.map(r => {
      const fg2m = r.fg2m || 0, fg2a = r.fg2a || 0;
      const fg3m = r.fg3m || 0, fg3a = r.fg3a || 0;
      return {
        playerId: r.playerId, minutes: r.minutes || 0,
        pts: r.pts || 0, reb: r.reb || 0, orb: r.orb || 0, drb: r.drb || 0,
        ast: r.ast || 0, stl: r.stl || 0, blk: r.blk || 0, tov: r.tov || 0,
        pf: r.pf || 0, fg2m, fg2a, fg3m, fg3a, fgm: fg2m + fg3m, fga: fg2a + fg3a,
        ftm: r.ftm || 0, fta: r.fta || 0,
      };
    });

    const res = await apiFetch("/api/admin/games", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seasonLeagueId: draft.seasonLeagueId,
        opponent:       draft.opponent,
        location:       draft.home ? "home" : "away",
        teamScore:      Number(draft.teamScore) || 0,
        opponentScore:  Number(draft.opponentScore) || 0,
        result:         draft.result,
        playedOn:       draft.date,
        sourceUrl:      draft.sourceUrl ?? null,
        youtubeUrl:     youtubeUrl.trim() || null,
        boxScore,
      }),
    });

    if (!res.ok) {
      const d = await res.json();
      showToast(d.error || "Save failed", "error");
      setPhase("review");
      return;
    }
    showToast("Game saved!");
    setPhase("idle");
    setDraft(null);
    setGameUrl("");
    setYoutubeUrl("");
    setHighlights({});
    setWarnings([]);
    setGameState(null);
  };

  const leagueOptions = seasonLeagues.map(sl => ({ value: sl.id, label: sl.leagueName }));

  const urlInputCls = "w-full py-[10px] px-3 text-[13px] font-sans rounded-lg border border-ak-border2 bg-ak-base text-ak-text outline-none";

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
    <AdminLayout slug={slug} title="Import" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <div className="max-w-[900px]">
        <div className="mb-6">
          <div className="text-[20px] font-black text-ak-text mb-1">Import game</div>
          <div className="text-[13px] text-ak-text-dim leading-[1.5]">
            Paste the game URL from basketcity.sportstats.gr -- the server fetches and parses it automatically.
          </div>
        </div>

        {dataLoading && <div className="flex justify-center py-10"><Spinner /></div>}

        {!dataLoading && phase === "idle" && (
          <div className="flex flex-col gap-[14px]">
            <div>
              <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[6px] uppercase">Game URL</div>
              <input
                type="url"
                value={gameUrl}
                onChange={e => setGameUrl(e.target.value)}
                placeholder="https://basketcity.sportstats.gr/men/gamedetails/id/..."
                disabled={fetching}
                className={urlInputCls}
              />
            </div>

            <div>
              <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[6px] uppercase">
                YouTube video URL <span className="font-normal normal-case text-[11px]">(optional)</span>
              </div>
              <input
                type="url"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={fetching}
                className={urlInputCls}
              />
            </div>

            {error && (
              <div className="text-xs text-ak-red-text py-2 px-3 rounded-lg bg-[#8b1a1a18] border border-[#8b1a1a40]">{error}</div>
            )}

            <div>
              <Btn onClick={fetchAndReview} disabled={!gameUrl.trim() || fetching}>
                {fetching ? "FETCHING..." : "FETCH & REVIEW"}
              </Btn>
            </div>

            {fetching && (
              <div className="flex items-center gap-[10px] text-ak-text-dim text-xs">
                <Spinner /> Scraping game page...
              </div>
            )}
          </div>
        )}

        {!dataLoading && (phase === "review" || phase === "saving") && draft && (
          <div className="flex flex-col gap-4">
            {gameState && gameState.state !== "final" && (
              <div className={[
                "py-[10px] px-[14px] rounded-lg text-xs border",
                gameState.state === "scheduled"
                  ? "bg-[#8b1a1a18] border-[#8b1a1a40] text-ak-red-text"
                  : "bg-[#8b5a0018] border-[#8b5a0040] text-[#b8860b]",
              ].join(" ")}>
                <div className="font-black mb-0.5">
                  {gameState.state === "scheduled" ? "Game not yet played" : "Game may still be in progress"}
                </div>
                <div>{gameState.reason}</div>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="py-[10px] px-[14px] rounded-lg bg-[#8b1a1a18] border border-[#8b1a1a40] text-xs text-ak-red-text">
                <div className="font-black mb-1">⚠ Warnings -- review before saving:</div>
                {warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}

            <div>
              <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[10px] uppercase">Game info</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-[10px]">
                <F label="DATE"       value={draft.date}          onChange={v => updDraft("date", v)}          placeholder="YYYY-MM-DD" />
                <F label="OPPONENT"   value={draft.opponent}      onChange={v => updDraft("opponent", v)} />
                <Sel label="LEAGUE"   value={draft.seasonLeagueId || ""} onChange={v => updDraft("seasonLeagueId", v)} options={leagueOptions} />
                <Sel label="HOME/AWAY" value={draft.home ? "home" : "away"} onChange={v => updDraft("home", v === "home")} options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]} />
                <Sel label="RESULT"   value={draft.result}        onChange={v => updDraft("result", v)}        options={[{ value: "W", label: "Win" }, { value: "L", label: "Loss" }, { value: "T", label: "Tie" }]} />
                <F label="OUR SCORE"  value={draft.teamScore}     onChange={v => updDraft("teamScore", v)}     type="number" />
                <F label="OPP SCORE"  value={draft.opponentScore} onChange={v => updDraft("opponentScore", v)} type="number" />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[6px] uppercase">
                YouTube video URL <span className="font-normal normal-case text-[11px]">(optional)</span>
              </div>
              <input
                type="url"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className={urlInputCls}
              />
            </div>

            <div>
              <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[10px] uppercase">Box score -- green rows played</div>
              <BoxScoreTable players={players} rows={draft.boxScore} onUpdate={updBox} highlights={highlights} />
            </div>

            <div className="flex gap-[10px] pt-1">
              <Btn
                onClick={save}
                variant="green"
                disabled={phase === "saving" || gameState?.state === "scheduled"}
              >
                {phase === "saving" ? "SAVING..." : "SAVE GAME"}
              </Btn>
              <Btn variant="ghost" onClick={() => { setPhase("idle"); setDraft(null); setGameState(null); }} disabled={phase === "saving"}>BACK</Btn>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export async function getServerSideProps({ params }: { params: { slug: string } }) {
  if (!await validateAdminSlug(params.slug)) return { notFound: true };
  return { props: { validSlug: true } };
}
