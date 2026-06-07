import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { AdminLayout, Spinner, PasskeyLoginForm, Confirm, useAdminAuth, apiFetch } from "@/client/admin";
import type { Game, SeasonLeague } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";

const SAVED_MSG: Record<string, string> = {
  created: "Game added.",
  updated: "Game saved.",
  deleted: "Game deleted.",
};

const ROUND_LABEL: Record<string, string> = {
  quarterfinal: "Quarterfinal",
  semifinal:    "Semifinal",
  final:        "Final",
};

export default function GamesListPage({
  validSlug, showFallback, noPasskeys,
}: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [games,         setGames]         = useState<Game[]>([]);
  const [seasonLeagues, setSeasonLeagues] = useState<SeasonLeague[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; type?: string } | null>(null);
  const [confirm,       setConfirm]       = useState<Game | null>(null);
  const [search,        setSearch]        = useState("");
  const [leagueFilter,  setLeagueFilter]  = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    const saved = typeof router.query.saved === "string" ? router.query.saved : null;
    const msg = saved ? (Reflect.get(SAVED_MSG, saved) as string | undefined) : undefined;
    if (msg) {
      setToast({ msg, type: "success" });
      router.replace(`/admin/${slug}/games`, undefined, { shallow: true });
    }
  }, [router.isReady]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/data");
      if (res.ok) {
        const d = await res.json();
        setGames(d.games ?? []);
        setSeasonLeagues(d.seasonLeagues ?? []);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { if (authed && slug) loadData(); }, [authed, slug]);

  const deleteGame = async (g: Game) => {
    const res = await apiFetch("/api/admin/games", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ gameId: g.id, seasonLeagueId: g.seasonLeagueId }),
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

  const leagueNameById = useMemo(
    () => new Map(seasonLeagues.map(sl => [sl.id, sl.leagueName])),
    [seasonLeagues],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...games]
      .filter(g => !leagueFilter || g.seasonLeagueId === leagueFilter)
      .filter(g => !q || g.opponent.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.date ?? b.playedOn ?? "").getTime() - new Date(a.date ?? a.playedOn ?? "").getTime());
  }, [games, search, leagueFilter]);

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
    <AdminLayout slug={slug} title="Games" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <header className="flex items-end justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-[22px] md:text-[28px] font-black text-ak-text">Games</h1>
          <div className="text-[11px] font-black tracking-[0.12em] uppercase text-ak-text-dim mt-1">
            {loading ? "Loading..." : `${games.length} recorded${games.length >= 200 ? " · latest 200" : ""}`}
          </div>
        </div>
        <Link
          href={`/admin/${slug}/games/new`}
          className="inline-flex items-center gap-1 py-[9px] px-[16px] text-[12px] font-black tracking-[0.12em] uppercase rounded-lg bg-ak-red text-ak-text"
        >
          + Add game
        </Link>
      </header>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search opponent..."
          className="flex-1 sm:max-w-[280px] py-[8px] px-[12px] text-[13px] rounded-[7px] border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none"
        />
        <select
          value={leagueFilter}
          onChange={e => setLeagueFilter(e.target.value)}
          className="py-[8px] px-[12px] text-[13px] rounded-[7px] border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none"
        >
          <option value="">All leagues</option>
          {seasonLeagues.map(sl => (
            <option key={sl.id} value={sl.id}>{sl.leagueName}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <GamesSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState slug={String(slug)} filtered={Boolean(search || leagueFilter)} />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map(g => (
            <li key={g.id}>
              <GameRow
                game={g}
                slug={String(slug)}
                leagueName={leagueNameById.get(g.seasonLeagueId) ?? ""}
                onDelete={() => setConfirm(g)}
              />
            </li>
          ))}
        </ul>
      )}

      {confirm && (
        <Confirm
          msg={`Delete game vs ${confirm.opponent} (${confirm.date ?? confirm.playedOn?.slice(0, 10) ?? ""})?`}
          onConfirm={() => deleteGame(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </AdminLayout>
  );
}

function GameRow({ game, slug, leagueName, onDelete }: {
  game: Game; slug: string; leagueName: string; onDelete: () => void;
}) {
  const isHome = game.home ?? game.location === "home";
  const dateStr = game.date ?? game.playedOn?.slice(0, 10) ?? "";
  const round = (game as { round?: string }).round;
  const roundLabel = round && round !== "regular" ? Reflect.get(ROUND_LABEL, round) as string | undefined : undefined;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-ak-border bg-ak-surface p-3 md:p-4">
      <Link
        href={`/admin/${slug}/games/${game.id}`}
        className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-90"
      >
        <span className={[
          "w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black shrink-0",
          game.result === "W" ? "bg-[#4caf7d25] text-ak-green" : "bg-[#8b1a1a25] text-ak-red-text",
        ].join(" ")}>
          {game.result}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-black text-[13px] md:text-[14px] text-ak-text">
            <span className="text-ak-text-dim mr-1">{isHome ? "vs" : "@"}</span>
            <span className="truncate">{game.opponent}</span>
            <span className="font-normal text-ak-text-dim ml-2">
              {game.score ?? `${game.teamScore}-${game.opponentScore}`}
            </span>
          </div>
          <div className="text-[11px] text-ak-text-dim mt-0.5">
            {dateStr}{leagueName && <> · {leagueName}</>}
            {roundLabel && <span className="ml-2 text-ak-red-text font-bold">{roundLabel}</span>}
          </div>
        </div>
      </Link>
      <button
        onClick={onDelete}
        className="py-[6px] px-3 text-[11px] font-black tracking-[0.12em] uppercase rounded-md border border-transparent bg-[#7f1d1d] text-ak-text cursor-pointer shrink-0"
      >
        Delete
      </button>
    </div>
  );
}

function EmptyState({ slug, filtered }: { slug: string; filtered: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
      <div className="text-[15px] font-black text-ak-text mb-1">
        {filtered ? "No matches" : "No games recorded yet"}
      </div>
      <div className="text-[12px] text-ak-text-dim mb-4">
        {filtered
          ? "Try a different search or clear the filters."
          : "Import a game or add the box score by hand."}
      </div>
      {!filtered && (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href={`/admin/${slug}/import`}
            className="inline-flex items-center gap-1 py-[9px] px-[16px] text-[12px] font-black tracking-[0.12em] uppercase rounded-lg bg-ak-red text-ak-text"
          >
            Import a game
          </Link>
          <Link
            href={`/admin/${slug}/games/new`}
            className="inline-flex items-center gap-1 py-[9px] px-[16px] text-[12px] font-black tracking-[0.12em] uppercase rounded-lg border border-ak-border2 text-ak-text-sub"
          >
            Add by hand
          </Link>
        </div>
      )}
    </div>
  );
}

function GamesSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map(i => (
        <li key={i} className="rounded-xl border border-ak-border bg-ak-surface h-[72px] animate-pulse" />
      ))}
    </ul>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
