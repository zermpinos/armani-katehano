/**
 * pages/admin/[slug]/import.js
 * Admin enters a game URL -> server scrapes it -> admin reviews -> saves.
 * Also accepts an optional YouTube video URL.
 */

import { useState } from "react";
import { useRouter } from "next/router";
import { AdminLayout, Spinner, PasskeyLoginForm, useAdminAuth, apiFetch } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";
import { resolveImportUrl } from "@/domain/shared/format";
import { buildDraft } from "@/client/admin/import/build-draft";
import type { ImportDraft } from "@/client/admin/import/build-draft";
import { useImportData } from "@/client/admin/import/use-import-data";
import { IdleForm } from "@/client/admin/import/IdleForm";
import { ReviewForm } from "@/client/admin/import/ReviewForm";

export default function ImportPage({ validSlug, showFallback, noPasskeys }: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: checking, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);
  const { players, seasonLeagues, schedule, setSchedule, dataLoading } = useImportData(authed);

  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(null);

  const [gameUrl,    setGameUrl]    = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [fetching,   setFetching]   = useState(false);
  const [phase,      setPhase]      = useState("idle");
  const [draft,      setDraft]      = useState<ImportDraft | null>(null);
  const [highlights, setHighlights] = useState<Record<string, boolean>>({});
  const [warnings,   setWarnings]   = useState<string[]>([]);
  const [error,      setError]      = useState("");
  const [gameState,  setGameState]  = useState<{ state: string; reason: string } | null>(null);
  const [offRating,  setOffRating]  = useState<number | null>(null);
  const [defRating,  setDefRating]  = useState<number | null>(null);

  const showToast = (msg: string, type = "success") => setToast({ msg, type });

  const fetchAndReview = async (overrideUrl?: string) => {
    const target = resolveImportUrl(overrideUrl, gameUrl);
    if (overrideUrl) setGameUrl(overrideUrl);
    setError("");
    setFetching(true);
    try {
      const res = await apiFetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || "Scrape failed"); return; }

      const { draft: d, highlights: hl, warnings: w, offRating: off, defRating: def } = buildDraft(body.data, players, seasonLeagues);
      setDraft(d); setHighlights(hl); setWarnings(w);
      setOffRating(off ?? null); setDefRating(def ?? null);
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
        playerId: r.playerId, minutes: r.min || 0,
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
    setOffRating(null);
    setDefRating(null);
    fetch("/api/admin/schedule").then(r => r.ok ? r.json() : null).then(d => { if (d) setSchedule(d.schedule ?? []); });
  };

  const handleBack = () => { setPhase("idle"); setDraft(null); setGameState(null); setOffRating(null); setDefRating(null); };

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
    <AdminLayout slug={slug} title="Import" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <div className="max-w-[900px]">
        <div className="mb-6">
          <div className="text-[20px] font-black text-ak-text mb-1">Import game</div>
          <div className="text-[13px] text-ak-text-dim leading-[1.5]">
            Paste the game URL from basketcity.sportstats.gr - the server fetches and parses it automatically.
          </div>
        </div>

        {dataLoading && <div className="flex justify-center py-10"><Spinner /></div>}

        {!dataLoading && phase === "idle" && (
          <IdleForm
            schedule={schedule}
            gameUrl={gameUrl}
            setGameUrl={setGameUrl}
            youtubeUrl={youtubeUrl}
            setYoutubeUrl={setYoutubeUrl}
            fetching={fetching}
            error={error}
            onFetch={fetchAndReview}
          />
        )}

        {!dataLoading && (phase === "review" || phase === "saving") && draft && (
          <ReviewForm
            draft={draft}
            phase={phase}
            gameState={gameState}
            warnings={warnings}
            offRating={offRating}
            defRating={defRating}
            youtubeUrl={youtubeUrl}
            setYoutubeUrl={setYoutubeUrl}
            players={players}
            highlights={highlights}
            seasonLeagues={seasonLeagues}
            updDraft={updDraft}
            updBox={updBox}
            onSave={save}
            onBack={handleBack}
          />
        )}
      </div>
    </AdminLayout>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
