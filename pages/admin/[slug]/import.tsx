import { useState, useMemo, type ReactNode } from "react";
import { useRouter } from "next/router";
import { AdminLayout, Spinner, PasskeyLoginForm, useAdminAuth, apiFetch } from "@/client/admin";
import type { ScheduledGame } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";
import { fmtDate, resolveImportUrl } from "@/domain/shared/format";
import { buildDraft } from "@/client/admin/import/build-draft";
import type { ImportDraft } from "@/client/admin/import/build-draft";
import { useImportData } from "@/client/admin/import/use-import-data";
import { IdleForm } from "@/client/admin/import/IdleForm";
import { ReviewForm } from "@/client/admin/import/ReviewForm";

export default function ImportPage({
  validSlug, showFallback, noPasskeys,
}: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;
  const upcomingGameId = typeof router.query.upcomingGameId === "string" ? router.query.upcomingGameId : null;

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);
  const { players, seasonLeagues, schedule, setSchedule, dataLoading } = useImportData(authed);

  const [toast,      setToast]      = useState<{ msg: string; type?: string } | null>(null);
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

  const linkedUpcoming = useMemo<ScheduledGame | null>(
    () => upcomingGameId ? schedule.find(g => g.id === upcomingGameId) ?? null : null,
    [upcomingGameId, schedule],
  );

  const showToast = (msg: string, type = "success") => setToast({ msg, type });

  const fetchAndReview = async (overrideUrl?: string) => {
    const target = resolveImportUrl(overrideUrl, gameUrl);
    if (overrideUrl) setGameUrl(overrideUrl);
    setError("");
    setFetching(true);
    try {
      const res = await apiFetch("/api/admin/scrape", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: target }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || "Scrape failed"); return; }

      const { draft: d, highlights: hl, warnings: w, offRating: off, defRating: def } =
        buildDraft(body.data, players, seasonLeagues);
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
    ...d,
    boxScore: d.boxScore.map(r => r.playerId === playerId ? { ...r, [k]: parseFloat(v) || 0 } : r),
  } as ImportDraft) : d);

  // After a successful save, if the import was launched from a Schedule row,
  // PATCH the matching UpcomingGame so the Imported badge appears on the list.
  const patchLinkedUpcoming = async (savedSourceUrl: string | null) => {
    if (!linkedUpcoming || !savedSourceUrl) return;
    try {
      await apiFetch("/api/admin/schedule", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:           linkedUpcoming.id,
          opponent:     linkedUpcoming.opponent,
          scheduledFor: linkedUpcoming.scheduledFor,
          location:     linkedUpcoming.location,
          competition:  linkedUpcoming.competition ?? null,
          notes:        linkedUpcoming.notes ?? null,
          sourceUrl:    savedSourceUrl,
        }),
      });
    } catch {
      // Non-fatal: game was still saved.
    }
  };

  const save = async () => {
    if (!draft) return;
    setPhase("saving");
    const boxScore = draft.boxScore.map(r => {
      const fg2m = r.fg2m || 0, fg2a = r.fg2a || 0;
      const fg3m = r.fg3m || 0, fg3a = r.fg3a || 0;
      return {
        playerId: r.playerId,
        minutes:  r.min || 0,
        pts: r.pts || 0, reb: r.reb || 0, orb: r.orb || 0, drb: r.drb || 0,
        ast: r.ast || 0, stl: r.stl || 0, blk: r.blk || 0, tov: r.tov || 0,
        pf: r.pf || 0, fg2m, fg2a, fg3m, fg3a, fgm: fg2m + fg3m, fga: fg2a + fg3a,
        ftm: r.ftm || 0, fta: r.fta || 0,
      };
    });

    const res = await apiFetch("/api/admin/games", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
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

    await patchLinkedUpcoming(draft.sourceUrl ?? null);

    showToast("Game saved.");
    setPhase("idle");
    setDraft(null);
    setGameUrl(""); setYoutubeUrl("");
    setHighlights({}); setWarnings([]);
    setGameState(null); setOffRating(null); setDefRating(null);

    // Refresh schedule so the just-imported entry now shows as Imported.
    fetch("/api/admin/schedule").then(r => r.ok ? r.json() : null).then(d => {
      if (d) setSchedule(d.schedule ?? []);
    });

    if (linkedUpcoming) {
      router.replace(`/admin/${slug}/import`, undefined, { shallow: true });
    }
  };

  const handleBack = () => {
    setPhase("idle"); setDraft(null);
    setGameState(null); setOffRating(null); setDefRating(null);
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

  return (
    <AdminLayout slug={slug} title="Import" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <header className="mb-5 max-w-[900px]">
        <h1 className="text-[22px] md:text-[28px] font-black text-ak-text">Import game</h1>
        <div className="text-[12px] text-ak-text-dim mt-1 leading-relaxed">
          Paste the official stats URL. The server scrapes it, you review the box score and any
          warnings, then save.
        </div>
      </header>

      {linkedUpcoming && phase === "idle" && (
        <div className="max-w-[900px] mb-4 rounded-xl border border-[#c9a84c55] bg-[#c9a84c12] px-4 py-3 flex items-start gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black tracking-[0.15em] uppercase text-ak-gold mb-1">
              Importing for
            </div>
            <div className="text-[13px] font-black text-ak-text">
              {linkedUpcoming.location === "home" ? "vs" : "@"} {linkedUpcoming.opponent}
            </div>
            <div className="text-[11px] text-ak-text-dim mt-0.5">
              {fmtDate(linkedUpcoming.scheduledFor)}
              {linkedUpcoming.competition && <> · {linkedUpcoming.competition}</>}
            </div>
          </div>
          <button
            onClick={() => router.replace(`/admin/${slug}/import`, undefined, { shallow: true })}
            className="text-[10px] font-black tracking-[0.12em] uppercase text-ak-text-dim cursor-pointer bg-transparent border-0"
          >
            Clear
          </button>
        </div>
      )}

      <div className="max-w-[900px]">
        {dataLoading && (
          <div className="flex justify-center py-10"><Spinner /></div>
        )}

        {!dataLoading && phase === "idle" && (
          <Panel label="Paste a game URL">
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
          </Panel>
        )}

        {!dataLoading && (phase === "review" || phase === "saving") && draft && (
          <Panel label="Review">
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
          </Panel>
        )}
      </div>
    </AdminLayout>
  );
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ak-border bg-ak-surface p-4 md:p-5">
      <div className="text-[10px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-3">{label}</div>
      {children}
    </section>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
