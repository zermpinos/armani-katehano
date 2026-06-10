import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { AdminLayout, Spinner, PasskeyLoginForm, Confirm, useAdminAuth, apiFetch } from "@/client/admin";
import type { ScheduledGame } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";
import { fmtDate } from "@/domain/shared/format";

const SAVED_MSG: Record<string, string> = {
  created: "Game scheduled!",
  updated: "Game updated!",
  deleted: "Game deleted.",
};

export default function SchedulePage({
  validSlug, showFallback, noPasskeys,
}: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [schedule, setSchedule] = useState<ScheduledGame[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; type?: string } | null>(null);
  const [confirm,  setConfirm]  = useState<ScheduledGame | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const saved = typeof router.query.saved === "string" ? router.query.saved : null;
    const msg = saved ? (Reflect.get(SAVED_MSG, saved) as string | undefined) : undefined;
    if (msg) {
      setToast({ msg, type: "success" });
      router.replace(`/admin/${slug}/schedule`, undefined, { shallow: true });
    }
  }, [router, slug]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/schedule");
      if (res.ok) {
        const d = await res.json();
        setSchedule(d.schedule ?? []);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (authed && slug) loadData();
  }, [authed, slug]);

  const deleteGame = async (g: ScheduledGame) => {
    const res = await apiFetch("/api/admin/schedule", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: g.id }),
    });
    if (!res.ok) {
      const body = await res.json();
      setToast({ msg: body.error ?? "Delete failed", type: "error" });
      return;
    }
    setToast({ msg: "Game deleted.", type: "success" });
    setConfirm(null);
    loadData();
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

  const sorted = [...schedule].sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
  );

  return (
    <AdminLayout slug={slug} title="Schedule" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <header className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <h1 className="text-[22px] md:text-[28px] font-black text-ak-text">Schedule</h1>
        <Link
          href={`/admin/${slug}/schedule/new`}
          className="inline-flex items-center gap-1 py-[9px] px-[16px] text-[12px] font-black tracking-[0.12em] uppercase rounded-lg bg-ak-red text-ak-text"
        >
          + Schedule game
        </Link>
      </header>

      {loading ? (
        <ScheduleSkeleton />
      ) : sorted.length === 0 ? (
        <EmptyState slug={String(slug)} />
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map(g => (
            <li key={g.id}>
              <ScheduleCard
                game={g}
                slug={String(slug)}
                onDelete={() => setConfirm(g)}
              />
            </li>
          ))}
        </ul>
      )}

      {confirm && (
        <Confirm
          msg={`Delete game vs ${confirm.opponent} (${fmtDate(confirm.scheduledFor)})?`}
          onConfirm={() => deleteGame(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </AdminLayout>
  );
}

function ScheduleCard({
  game, slug, onDelete,
}: { game: ScheduledGame; slug: string; onDelete: () => void }) {
  const time = game.scheduledFor.slice(11, 16);
  const hasSource = Boolean(game.sourceUrl);
  return (
    <div className="rounded-xl border border-ak-border bg-ak-surface p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black tracking-[0.12em] uppercase text-ak-text-dim">
              {game.location === "home" ? "vs" : "@"}
            </span>
            <span className="text-[15px] md:text-[16px] font-black text-ak-text">
              {game.opponent}
            </span>
            {hasSource && (
              <span
                className="text-[10px] font-black tracking-[0.1em] uppercase text-ak-green bg-[#4caf7d22] border border-[#4caf7d55] rounded-md px-2 py-[2px]"
                title={game.sourceUrl ?? undefined}
              >
                Imported
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-ak-text-dim">
            {fmtDate(game.scheduledFor)} · {time}
            {game.competition && <> · {game.competition}</>}
          </div>
          {game.notes && (
            <div className="mt-1 text-[11px] text-ak-text-dim italic truncate">
              {game.notes}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!hasSource && (
            <Link
              href={`/admin/${slug}/import?upcomingGameId=${game.id}`}
              className="py-[6px] px-3 text-[11px] font-black tracking-[0.12em] uppercase rounded-md border border-ak-border2 text-ak-text-sub"
            >
              Import
            </Link>
          )}
          <Link
            href={`/admin/${slug}/schedule/${game.id}`}
            className="py-[6px] px-3 text-[11px] font-black tracking-[0.12em] uppercase rounded-md border border-ak-border2 text-ak-text-sub"
          >
            Edit
          </Link>
          <button
            onClick={onDelete}
            className="py-[6px] px-3 text-[11px] font-black tracking-[0.12em] uppercase rounded-md border border-transparent bg-[#7f1d1d] text-ak-text cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ slug }: { slug: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
      <div className="text-[15px] font-black text-ak-text mb-1">No upcoming games</div>
      <div className="text-[12px] text-ak-text-dim mb-4">
        Schedule the next fixture so it shows up on the public site and the dashboard.
      </div>
      <Link
        href={`/admin/${slug}/schedule/new`}
        className="inline-flex items-center gap-1 py-[9px] px-[16px] text-[12px] font-black tracking-[0.12em] uppercase rounded-lg bg-ak-red text-ak-text"
      >
        + Schedule the first one
      </Link>
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1, 2].map(i => (
        <li key={i} className="rounded-xl border border-ak-border bg-ak-surface h-[96px] animate-pulse" />
      ))}
    </ul>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
