import { useMemo, useRef, useState, type ReactNode } from "react";
import type { GetServerSidePropsContext } from "next";
import { adminLayout, useAdminSession, useAdminData, apiFetch, sendForResult, Btn, ListRow, ShowAllToggle } from "@/client/admin";
import type { SeasonLeague, Season, League, Player } from "@/client/admin";
import { ORGANIZATIONS } from "@/domain/leagues/organizations";
import { getAdminPageProps } from "@/server/auth";
import { SeasonSheet, NewSeasonSheet } from "@/client/admin/seasons/SeasonSheet";
import { LeagueSheet, NewLeagueSheet } from "@/client/admin/seasons/LeagueSheet";
import {
  EMPTY_SEASON, emptyLeague, toSeasonDraft, datesChanged, rosterChanged, enrolledBySeason,
  validateNewSeason, validateLeague, type SeasonDraft, type NewSeasonDraft, type LeagueDraft,
} from "@/client/admin/seasons/season-draft";

const SEASONS = "/api/admin/seasons-list";
const LEAGUES = "/api/admin/leagues-list";
// Managing seasons is the one place a closed season still has to show.
const LINKS   = "/api/admin/season-leagues?includeArchived=true";
const PLAYERS = "/api/admin/players";
const ENTRIES = "/api/admin/roster-entries";

type Content =
  | { kind: "season";    season: Season; draft: SeasonDraft; linkLeagueId: string }
  | { kind: "newSeason"; draft: NewSeasonDraft }
  | { kind: "league";    league: League; listingUrl: string }
  | { kind: "newLeague"; draft: LeagueDraft };
type Sheet = Content & { error: string | null; busy: boolean; openCount: number };

const keyOf = (c: Content) =>
  c.kind === "season" ? `season:${c.season.id}` : c.kind === "league" ? `league:${c.league.id}` : c.kind;

const jsonInit = (method: string, body: unknown) =>
  ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const orgName = (id: string) => (Reflect.get(ORGANIZATIONS, id) as { name?: string } | undefined)?.name ?? id;

export default function SeasonsPage() {
  const { setToast } = useAdminSession();
  const seasonsQ = useAdminData<{ seasons?: Season[] }>(SEASONS);
  const leaguesQ = useAdminData<{ leagues?: League[] }>(LEAGUES);
  const linksQ   = useAdminData<{ seasonLeagues?: SeasonLeague[] }>(LINKS);
  const playersQ = useAdminData<{ players?: Player[] }>(PLAYERS);
  const entriesQ = useAdminData<{ entries?: Array<{ seasonId: string; playerId: string }> }>(ENTRIES);
  const queries  = [seasonsQ, leaguesQ, linksQ, playersQ, entriesQ];
  const loading  = queries.some(q => q.data === undefined && !q.error);
  const failed   = !loading && queries.some(q => q.data === undefined);

  const [showAll, setShowAll] = useState(false);
  const [sheet,   setSheet]   = useState<Sheet | null>(null);
  // Drafts held after a 401, so the sign-in overlay can be reached without losing what was typed.
  const [kept,    setKept]    = useState<ReadonlyMap<string, Content>>(new Map());
  const opens = useRef(0);
  const openId = useRef<number | null>(null);

  const seasons  = seasonsQ.data?.seasons ?? [];
  const leagues  = leaguesQ.data?.leagues ?? [];
  const links    = linksQ.data?.seasonLeagues ?? [];
  const players  = playersQ.data?.players ?? [];
  const enrolled = useMemo(() => enrolledBySeason(entriesQ.data?.entries ?? []), [entriesQ.data]);
  const visible  = showAll ? seasons : seasons.filter(s => !s.archivedAt);
  const linkedTo = (s: Season) => links.filter(sl => sl.seasonName === s.name);
  const enrolledIn = (s: Season): ReadonlySet<string> => enrolled.get(s.id) ?? new Set<string>();

  const keep   = (c: Content) => setKept(k => new Map(k).set(keyOf(c), c));
  const forget = (key: string) => setKept(k => { const next = new Map(k); next.delete(key); return next; });

  const open = (content: Content) => {
    opens.current += 1;
    openId.current = opens.current;
    setSheet({ ...(kept.get(keyOf(content)) ?? content), error: null, busy: false, openCount: opens.current });
  };
  const closeSheet = () => {
    if (!sheet) return;
    forget(keyOf(sheet));
    openId.current = null;
    setSheet(null);
  };
  const patch = (fn: (s: Sheet) => Sheet) => setSheet(s => (s ? { ...fn(s), error: null } : s));

  const refreshAll = () => Promise.all([seasonsQ.refresh(), leaguesQ.refresh(), linksQ.refresh(), entriesQ.refresh()]);

  // Seasons change a few times a year, so a save waits for the server instead of updating the lists ahead of it.
  const run = async (current: Sheet, send: () => Promise<Response>, okMsg: string, close = true) => {
    const mine = (s: Sheet | null): s is Sheet => s !== null && s.openCount === current.openCount;
    setSheet(s => (mine(s) ? { ...s, busy: true, error: null } : s));
    const result = await sendForResult(send, "Request failed");
    if (result.ok) {
      forget(keyOf(current));
      await refreshAll();
      setToast({ msg: okMsg, type: "success" });
      setSheet(s => (mine(s) ? (close ? null : { ...s, busy: false }) : s));
      return;
    }
    if (result.status === 401) {
      // The sheet is a modal dialog above the sign-in overlay, so it closes and keeps the draft.
      // A sheet the user already closed must not bring its discarded draft back.
      if (openId.current === current.openCount) keep(current);
      setSheet(s => (mine(s) ? null : s));
      return;
    }
    // A two-step save may have stored the dates already, so the cached lists must catch up.
    void refreshAll();
    setSheet(s => (mine(s) ? { ...s, busy: false, error: result.message } : s));
  };

  const saveSeason = () => {
    if (sheet?.kind !== "season") return;
    const { season, draft } = sheet;
    const dates  = datesChanged(season, draft);
    const roster = rosterChanged(enrolledIn(season), draft);
    if (!dates && !roster) return;
    void run(sheet, async () => {
      if (dates) {
        const res = await apiFetch(`/api/admin/seasons/${season.id}`, jsonInit("PATCH", { startDate: draft.start, endDate: draft.end }));
        if (!res.ok || !roster) return res;
      }
      return apiFetch("/api/admin/roster-entries", jsonInit("PUT", { seasonId: season.id, playerIds: [...draft.playerIds] }));
    }, `${season.name} saved.`);
  };

  const linkLeague = () => {
    if (sheet?.kind !== "season" || !sheet.linkLeagueId) return;
    const { season, linkLeagueId } = sheet;
    void run(sheet, () => apiFetch(`/api/admin/seasons/${season.id}`, jsonInit("PATCH", { leagueIds: [linkLeagueId] })), "League linked.", false);
  };

  const toggleArchive = () => {
    if (sheet?.kind !== "season") return;
    const { season } = sheet;
    const verb = season.archivedAt ? "unarchive" : "archive";
    void run(sheet, () => apiFetch(`/api/admin/seasons/${season.id}/${verb}`, { method: "POST" }), `${season.name} ${verb}d.`);
  };

  const createSeason = () => {
    if (sheet?.kind !== "newSeason") return;
    const { draft } = sheet;
    const invalid = validateNewSeason(draft);
    if (invalid) { setSheet({ ...sheet, error: invalid }); return; }
    void run(sheet, () => apiFetch("/api/admin/seasons", jsonInit("POST", draft)), "Season created.");
  };

  const createLeague = () => {
    if (sheet?.kind !== "newLeague") return;
    const { draft } = sheet;
    const invalid = validateLeague(draft);
    if (invalid) { setSheet({ ...sheet, error: invalid }); return; }
    void run(sheet, () => apiFetch("/api/admin/leagues", jsonInit("POST", { ...draft, seasonId: draft.seasonId || undefined })), "League created.");
  };

  const saveListing = () => {
    if (sheet?.kind !== "league") return;
    const { league, listingUrl } = sheet;
    // Empty clears it, which is how a league stops being polled.
    void run(sheet, () => apiFetch("/api/admin/leagues", jsonInit("PATCH", { id: league.id, listingUrl: listingUrl.trim() || null })), "Listing URL saved.");
  };

  const ss = sheet?.kind === "season" ? sheet : null;
  const ns = sheet?.kind === "newSeason" ? sheet : null;
  const ls = sheet?.kind === "league" ? sheet : null;
  const nl = sheet?.kind === "newLeague" ? sheet : null;

  return (
    <>
      <h1 className="mb-6 text-[22px] font-black text-ak-text md:text-[28px]">Seasons &amp; leagues</h1>

      {loading ? (
        <ListSkeleton />
      ) : failed ? (
        <LoadFailed onRetry={() => void Promise.all(queries.map(q => q.refresh()))} />
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <SectionHeader title="Seasons">
              <Btn size="sm" onClick={() => open({ kind: "newSeason", draft: EMPTY_SEASON })}>+ ADD SEASON</Btn>
            </SectionHeader>
            {visible.length === 0 ? (
              <Empty>No current season. Tap + Add season to start one.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {visible.map(s => {
                  const games = s.gameCount ?? 0;
                  const count = linkedTo(s).length;
                  return (
                    <li key={s.id}>
                      <ListRow onClick={() => open({ kind: "season", season: s, draft: toSeasonDraft(s, enrolledIn(s)), linkLeagueId: "" })}>
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-black text-ak-text">{s.name}</span>
                          {s.archivedAt && (
                            <span className="rounded-md border border-ak-border2 px-2 py-[2px] text-[10px] font-black uppercase tracking-[0.1em] text-ak-text-dim">Archived</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[12px] text-ak-text-dim">
                          {games} game{games === 1 ? "" : "s"} · {count} league{count === 1 ? "" : "s"} · {enrolledIn(s).size} players
                        </div>
                      </ListRow>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-3">
              <ShowAllToggle showAll={showAll} onToggle={() => setShowAll(v => !v)} hiddenCount={seasons.length - visible.length} hiddenLabel="archived" />
            </div>
          </section>

          <section>
            <SectionHeader title="Leagues">
              <Btn size="sm" onClick={() => open({ kind: "newLeague", draft: emptyLeague(seasons[0]?.id ?? "") })}>+ ADD LEAGUE</Btn>
            </SectionHeader>
            {leagues.length === 0 ? (
              <Empty>No leagues yet. Tap + Add league to create one.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {leagues.map(l => (
                  <li key={l.id}>
                    <ListRow onClick={() => open({ kind: "league", league: l, listingUrl: l.listingUrl ?? "" })}>
                      <div className="text-[15px] font-black text-ak-text">{l.name}</div>
                      <div className="mt-0.5 text-[12px] text-ak-text-dim">
                        {orgName(l.organization)} · {l.listingUrl ? "Listing URL set" : "No listing URL, not polled"}
                      </div>
                    </ListRow>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <SeasonSheet
        open={ss !== null}
        resetKey={ss?.openCount}
        season={ss?.season ?? null}
        draft={ss?.draft ?? null}
        linked={ss ? linkedTo(ss.season).map(sl => sl.leagueName) : []}
        leagues={leagues}
        linkLeagueId={ss?.linkLeagueId ?? ""}
        players={players}
        error={ss?.error ?? null}
        busy={ss?.busy ?? false}
        canSave={ss !== null && (datesChanged(ss.season, ss.draft) || rosterChanged(enrolledIn(ss.season), ss.draft))}
        onChange={d => patch(s => (s.kind === "season" ? { ...s, draft: d } : s))}
        onLinkChange={id => patch(s => (s.kind === "season" ? { ...s, linkLeagueId: id } : s))}
        onLink={linkLeague}
        onSave={saveSeason}
        onArchive={toggleArchive}
        onClose={closeSheet}
      />
      <NewSeasonSheet
        open={ns !== null}
        resetKey={ns?.openCount}
        draft={ns?.draft ?? EMPTY_SEASON}
        error={ns?.error ?? null}
        busy={ns?.busy ?? false}
        onChange={d => patch(s => (s.kind === "newSeason" ? { ...s, draft: d } : s))}
        onSave={createSeason}
        onClose={closeSheet}
      />
      <LeagueSheet
        open={ls !== null}
        resetKey={ls?.openCount}
        league={ls?.league ?? null}
        listingUrl={ls?.listingUrl ?? ""}
        error={ls?.error ?? null}
        busy={ls?.busy ?? false}
        onChange={url => patch(s => (s.kind === "league" ? { ...s, listingUrl: url } : s))}
        onSave={saveListing}
        onClose={closeSheet}
      />
      <NewLeagueSheet
        open={nl !== null}
        resetKey={nl?.openCount}
        draft={nl?.draft ?? emptyLeague("")}
        seasons={seasons}
        error={nl?.error ?? null}
        busy={nl?.busy ?? false}
        onChange={d => patch(s => (s.kind === "newLeague" ? { ...s, draft: d } : s))}
        onSave={createLeague}
        onClose={closeSheet}
      />
    </>
  );
}

SeasonsPage.getLayout = adminLayout("Seasons");

function SectionHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-ak-text-dim">{title}</h2>
      {children}
    </header>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-8 text-center text-[13px] text-ak-text-dim">
      {children}
    </div>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
      <div className="mb-4 text-[12px] text-ak-text-dim">Could not load seasons and leagues.</div>
      <Btn size="sm" onClick={onRetry}>Retry</Btn>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1, 2].map(i => <li key={i} className="h-[64px] animate-pulse rounded-xl border border-ak-border bg-ak-surface" />)}
    </ul>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return getAdminPageProps(ctx);
}
