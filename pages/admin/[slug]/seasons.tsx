import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import { AdminLayout, F, Sel, Btn, Spinner, PasskeyLoginForm, useAdminAuth, apiFetch } from "@/client/admin";
import type { SeasonLeague, Season, League } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";

export default function SeasonsPage({
  validSlug, showFallback, noPasskeys,
}: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [seasons,       setSeasons]       = useState<Season[]>([]);
  const [leagues,       setLeagues]       = useState<League[]>([]);
  const [seasonLeagues, setSeasonLeagues] = useState<SeasonLeague[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; type?: string } | null>(null);

  const [newSeason,    setNewSeason]    = useState({ name: "", year: "" });
  const [newLeague,    setNewLeague]    = useState({ name: "", organizer: "", level: "" });
  const [linkSeasonId, setLinkSeasonId] = useState("");
  const [linkLeagueId, setLinkLeagueId] = useState("");

  const [busyCreateSeason, setBusyCreateSeason] = useState(false);
  const [busyCreateLeague, setBusyCreateLeague] = useState(false);
  const [busyLink,         setBusyLink]         = useState(false);

  const showToast = (msg: string, type = "success") => setToast({ msg, type });

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, lRes, slRes] = await Promise.all([
        fetch("/api/admin/seasons-list"),
        fetch("/api/admin/leagues-list"),
        fetch("/api/admin/season-leagues"),
      ]);
      if (sRes.ok)  { const d = await sRes.json();  setSeasons(d.seasons ?? []);             setLinkSeasonId(prev => prev || d.seasons?.[0]?.id || ""); }
      if (lRes.ok)  { const d = await lRes.json();  setLeagues(d.leagues ?? []);             setLinkLeagueId(prev => prev || d.leagues?.[0]?.id || ""); }
      if (slRes.ok) { const d = await slRes.json(); setSeasonLeagues(d.seasonLeagues ?? []); }
    } finally { setLoading(false); }
  };

  useEffect(() => { if (authed && slug) loadData(); }, [authed, slug]);

  const createSeason = async () => {
    if (!newSeason.name || !newSeason.year) { showToast("Name and year required", "error"); return; }
    setBusyCreateSeason(true);
    const res = await apiFetch("/api/admin/seasons", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(newSeason),
    });
    setBusyCreateSeason(false);
    if (!res.ok) { const d = await res.json(); showToast(d.error || "Failed", "error"); return; }
    showToast("Season created.");
    setNewSeason({ name: "", year: "" });
    loadData();
  };

  const createLeague = async () => {
    if (!newLeague.name) { showToast("League name required", "error"); return; }
    setBusyCreateLeague(true);
    const res = await apiFetch("/api/admin/leagues", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...newLeague, seasonId: linkSeasonId || undefined }),
    });
    setBusyCreateLeague(false);
    if (!res.ok) { const d = await res.json(); showToast(d.error || "Failed", "error"); return; }
    showToast("League created.");
    setNewLeague({ name: "", organizer: "", level: "" });
    loadData();
  };

  const linkLeague = async () => {
    if (!linkLeagueId || !linkSeasonId) return;
    const season = seasons.find(s => s.id === linkSeasonId);
    if (!season) return;
    setBusyLink(true);
    const res = await apiFetch("/api/admin/seasons", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:      season.name,
        year:      season.year,
        leagueIds: [linkLeagueId],
      }),
    });
    setBusyLink(false);
    if (!res.ok) { const d = await res.json(); showToast(d.error || "Failed", "error"); return; }
    showToast("League linked.");
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

  const seasonOptions = seasons.map(s => ({ value: s.id, label: s.name }));
  const leagueOptions = leagues.map(l => ({ value: l.id, label: l.name }));

  return (
    <AdminLayout slug={slug} title="Seasons" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <h1 className="text-[22px] md:text-[28px] font-black text-ak-text mb-6">Seasons &amp; leagues</h1>

      {loading ? (
        <SeasonsSkeleton />
      ) : (
        <div className="flex flex-col gap-5">
          <Panel
            label="Active links"
            hint="Each league must be linked to a season before games can record stats under it."
          >
            {seasonLeagues.length === 0 ? (
              <div className="py-6 text-center text-[12px] text-ak-text-dim">
                Nothing linked yet. Create a season + a league below, then link them.
              </div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {seasonLeagues.map(sl => (
                  <li
                    key={sl.id}
                    className="py-[10px] px-[14px] rounded-[9px] border border-ak-border bg-ak-base"
                  >
                    <div className="font-black text-[13px] text-ak-text">{sl.leagueName}</div>
                    <div className="text-[11px] text-ak-text-dim mt-0.5">
                      {sl.seasonName} · {sl.leagueSlug}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <Panel label="Add a season" hint="Name + 4-digit year. Example: 2026-27 / 2026.">
              <div className="flex flex-col gap-3 mb-4">
                <F
                  label="NAME"
                  value={newSeason.name}
                  onChange={v => setNewSeason(s => ({ ...s, name: v }))}
                  placeholder="2026-27"
                />
                <F
                  label="YEAR"
                  value={newSeason.year}
                  onChange={v => setNewSeason(s => ({ ...s, year: v }))}
                  type="number"
                  placeholder="2026"
                />
              </div>
              <Btn
                onClick={createSeason}
                disabled={busyCreateSeason || !newSeason.name || !newSeason.year}
              >
                {busyCreateSeason ? "CREATING..." : "CREATE SEASON"}
              </Btn>
            </Panel>

            <Panel label="Add a league" hint="Links to the currently selected season.">
              <div className="flex flex-col gap-3 mb-4">
                <F
                  label="NAME"
                  value={newLeague.name}
                  onChange={v => setNewLeague(l => ({ ...l, name: v }))}
                  placeholder="BC6"
                />
                <F
                  label="ORGANIZER"
                  value={newLeague.organizer}
                  onChange={v => setNewLeague(l => ({ ...l, organizer: v }))}
                  placeholder="Basket City"
                />
                <F
                  label="LEVEL"
                  value={newLeague.level}
                  onChange={v => setNewLeague(l => ({ ...l, level: v }))}
                  placeholder="Amateur"
                />
                {seasons.length > 0 && (
                  <Sel
                    label="LINK TO SEASON"
                    value={linkSeasonId}
                    onChange={setLinkSeasonId}
                    options={seasonOptions}
                  />
                )}
              </div>
              <Btn
                onClick={createLeague}
                disabled={busyCreateLeague || !newLeague.name}
              >
                {busyCreateLeague ? "CREATING..." : "CREATE LEAGUE"}
              </Btn>
            </Panel>

            <Panel label="Link existing pair" hint="Pair a league that already exists with a season.">
              {seasons.length === 0 || leagues.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-ak-text-dim">
                  Need at least one season and one league.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 mb-4">
                    <Sel label="SEASON" value={linkSeasonId} onChange={setLinkSeasonId} options={seasonOptions} />
                    <Sel label="LEAGUE" value={linkLeagueId} onChange={setLinkLeagueId} options={leagueOptions} />
                  </div>
                  <Btn onClick={linkLeague} disabled={busyLink || !linkSeasonId || !linkLeagueId}>
                    {busyLink ? "LINKING..." : "LINK"}
                  </Btn>
                </>
              )}
            </Panel>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Panel({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ak-border bg-ak-surface p-4 md:p-5">
      <div className="text-[10px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-1">{label}</div>
      {hint && <div className="text-[11px] text-ak-text-dim mb-3 leading-relaxed">{hint}</div>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function SeasonsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-ak-border bg-ak-surface h-[160px] animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="rounded-xl border border-ak-border bg-ak-surface h-[200px] animate-pulse" />
        <div className="rounded-xl border border-ak-border bg-ak-surface h-[200px] animate-pulse" />
        <div className="rounded-xl border border-ak-border bg-ak-surface h-[200px] animate-pulse" />
      </div>
    </div>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
