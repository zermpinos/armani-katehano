import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { adminLayout, useAdminSession, useAdminData, Confirm, Btn, F, Sel, ShowAllToggle, apiFetch } from "@/client/admin";
import type { Game, SeasonLeague } from "@/client/admin";
import type { GetServerSidePropsContext } from "next";
import { getAdminPageProps } from "@/server/auth";

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

const CURRENT = "/api/admin/data";
const ALL     = "/api/admin/data?all=1";

type ListData = { currentSeason?: string | null; games?: Game[]; seasonLeagues?: SeasonLeague[]; olderCount?: number };

const NO_GAMES:   Game[]         = [];
const NO_LEAGUES: SeasonLeague[] = [];

export default function GamesListPage() {
  const router = useRouter();
  const { slug, setToast } = useAdminSession();

  const [showAll,      setShowAll]      = useState(false);
  const { data, error, refresh: loadData } = useAdminData<ListData>(showAll ? ALL : CURRENT);
  const games         = data?.games ?? NO_GAMES;
  const seasonLeagues = data?.seasonLeagues ?? NO_LEAGUES;
  const loading       = data === undefined && !error;
  const failed        = data === undefined && error;
  const [confirm,      setConfirm]      = useState<Game | null>(null);
  const [search,       setSearch]       = useState("");
  const [leagueFilter, setLeagueFilter] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    const saved = typeof router.query.saved === "string" ? router.query.saved : null;
    const msg = saved ? (Reflect.get(SAVED_MSG, saved) as string | undefined) : undefined;
    if (msg) {
      setToast({ msg, type: "success" });
      router.replace(`/admin/${slug}/games`, undefined, { shallow: true });
    }
  }, [router, slug, setToast]);

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
    () => new Map(seasonLeagues.map(sl => [sl.id, showAll ? `${sl.leagueName} · ${sl.seasonName}` : sl.leagueName])),
    [seasonLeagues, showAll],
  );
  const leagueOptions = [
    { value: "", label: "All leagues" },
    ...seasonLeagues.map(sl => ({ value: sl.id, label: leagueNameById.get(sl.id) ?? sl.leagueName })),
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...games]
      .filter(g => !leagueFilter || g.seasonLeagueId === leagueFilter)
      .filter(g => !q || g.opponent.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.date ?? b.playedOn ?? "").getTime() - new Date(a.date ?? a.playedOn ?? "").getTime());
  }, [games, search, leagueFilter]);

  const scope = showAll ? "in every season" : `in ${data?.currentSeason ?? "this season"}`;

  return (
    <>
      <header className="flex items-end justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-[22px] md:text-[28px] font-black text-ak-text">Games</h1>
          <div className="text-[11px] font-black tracking-[0.12em] uppercase text-ak-text-dim mt-1">
            {loading ? "Loading..." : failed ? "Not loaded" : `${games.length} ${scope}${games.length >= 200 ? " · latest 200" : ""}`}
          </div>
        </div>
        <Link
          href={`/admin/${slug}/games/new`}
          className="inline-flex min-h-[44px] items-center gap-1 py-[9px] px-[16px] text-[12px] font-black tracking-[0.12em] uppercase rounded-lg bg-ak-red text-ak-text"
        >
          + Add game
        </Link>
      </header>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <F label="SEARCH" type="search" value={search} onChange={setSearch} placeholder="Search opponent..." />
        <Sel label="LEAGUE" value={leagueFilter} onChange={setLeagueFilter} options={leagueOptions} />
      </div>

      {loading ? (
        <GamesSkeleton />
      ) : failed ? (
        <LoadFailed onRetry={() => void loadData()} />
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

      {(showAll || data !== undefined) && (
        <div className="mt-3">
          <ShowAllToggle
            showAll={showAll}
            onToggle={() => { setShowAll(s => !s); setLeagueFilter(""); }}
            hiddenCount={data?.olderCount ?? 0}
            hiddenLabel="older"
          />
        </div>
      )}

      {confirm && (
        <Confirm
          msg={`Delete game vs ${confirm.opponent} (${confirm.date ?? confirm.playedOn?.slice(0, 10) ?? ""})?`}
          onConfirm={() => deleteGame(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

GamesListPage.getLayout = adminLayout("Games");

function GameRow({ game, slug, leagueName, onDelete }: {
  game: Game; slug: string; leagueName: string; onDelete: () => void;
}) {
  const isHome = game.home ?? game.location === "home";
  const dateStr = game.date ?? game.playedOn?.slice(0, 10) ?? "";
  const roundLabel = game.round && game.round !== "regular" ? Reflect.get(ROUND_LABEL, game.round) as string | undefined : undefined;
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
      <Btn size="sm" variant="danger" onClick={onDelete}>DELETE</Btn>
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
            className="inline-flex min-h-[44px] items-center gap-1 py-[9px] px-[16px] text-[12px] font-black tracking-[0.12em] uppercase rounded-lg bg-ak-red text-ak-text"
          >
            Import a game
          </Link>
          <Link
            href={`/admin/${slug}/games/new`}
            className="inline-flex min-h-[44px] items-center gap-1 py-[9px] px-[16px] text-[12px] font-black tracking-[0.12em] uppercase rounded-lg border border-ak-border2 text-ak-text-sub"
          >
            Add by hand
          </Link>
        </div>
      )}
    </div>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
      <div className="text-[12px] text-ak-text-dim mb-4">Could not load games.</div>
      <Btn size="sm" onClick={onRetry}>Retry</Btn>
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

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return getAdminPageProps(ctx);
}
