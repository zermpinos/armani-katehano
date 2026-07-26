import { useState, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "next/router";
import { AdminLayout, Spinner, PasskeyLoginForm, useAdminAuth, apiFetch, byJersey } from "@/client/admin";
import type { Player, ScheduledGame } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";
import { fmtDate, resolveImportUrl } from "@/domain/shared/format";
import { diffDraft, toCommitInput } from "@/domain/import/resolve";
import type { ImportDraft, UnresolvedPlayer } from "@/domain/import/resolve";
import type { GateResult } from "@/domain/import/verify";
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
  const { players, setPlayers, seasonLeagues, schedule, setSchedule, dataLoading } = useImportData(authed);

  const [toast,      setToast]      = useState<{ msg: string; type?: string } | null>(null);
  const [gameUrl,    setGameUrl]    = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [fetching,   setFetching]   = useState(false);
  const [phase,      setPhase]      = useState("idle");
  const [draft,      setDraft]      = useState<ImportDraft | null>(null);
  const [highlights, setHighlights] = useState<Record<string, boolean>>({});
  const [gate,       setGate]       = useState<GateResult | null>(null);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [unresolvedPlayers, setUnresolvedPlayers] = useState<UnresolvedPlayer[]>([]);
  const [error,      setError]      = useState("");
  const [gameState,  setGameState]  = useState<{ state: string; reason: string } | null>(null);
  // Snapshot of the resolver's draft, before any review-form edits, for the
  // resolve-vs-saved diff. Edits are immutable, so this reference stays intact.
  const resolvedRef = useRef<ImportDraft | null>(null);

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

      setDraft(body.draft);
      setHighlights(body.highlights ?? {});
      setGate(body.gate ?? null);
      setUnresolved(body.unresolved ?? []);
      setUnresolvedPlayers(body.unresolvedPlayers ?? []);
      resolvedRef.current = body.draft;
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

  // The box score is built from the roster, so a new player has no row until
  // resolve() runs again, and the raw payload it needs lives on the server.
  // Re-scraping discards form edits, which is fine: an unresolved jersey blocks
  // the save, so there is nothing worth having edited yet.
  const handlePlayerCreated = async (player: Player) => {
    setPlayers(prev => [...prev, player].sort(byJersey));
    await fetchAndReview();
  };

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
    if (unresolved.length || unresolvedPlayers.length) {
      showToast("Cannot save while roster issues are unresolved.", "error");
      return;
    }
    setPhase("saving");
    const importDiff = resolvedRef.current ? diffDraft(resolvedRef.current, draft) : [];

    const res = await apiFetch("/api/admin/import", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...toCommitInput(draft),
        youtubeUrl: youtubeUrl.trim() || null,
        importDiff,
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
    setHighlights({}); setGate(null); setUnresolved([]); setUnresolvedPlayers([]);
    setGameState(null);

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
    setGate(null); setUnresolved([]); setUnresolvedPlayers([]);
    setGameState(null);
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
          Paste the official stats URL. The server scrapes it and verifies it against itself, you
          review the box score and any failed checks, then save.
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
              gate={gate}
              unresolved={unresolved}
              unresolvedPlayers={unresolvedPlayers}
              onPlayerCreated={handlePlayerCreated}
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
