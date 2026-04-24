/**
 * pages/admin/[slug]/seasons.js
 * Seasons & leagues management.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { AdminLayout, F, Sel, Btn, Spinner, LoginForm, useAdminAuth, apiFetch } from "@/client/admin";
import { validateAdminSlug } from '@/server/auth';

export default function SeasonsPage({ validSlug }: any) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  // Q-01: replaced ~25 lines of duplicated auth state + useEffect + login fn
  // with a single hook call.
  const { authed, loading: checking, loginError, handleLogin, handleLogout } = useAdminAuth(slug);

  const [seasons,       setSeasons]       = useState<any[]>([]);
  const [leagues,       setLeagues]       = useState<any[]>([]);
  const [seasonLeagues, setSeasonLeagues] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(null);

  const [newSeason,    setNewSeason]    = useState({ name: "", year: "" });
  const [newLeague,    setNewLeague]    = useState({ name: "", organizer: "", level: "" });
  const [linkSeasonId, setLinkSeasonId] = useState("");
  const [linkLeagueId, setLinkLeagueId] = useState("");

  const showToast = (msg: any, type = "success") => setToast({ msg, type });

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, lRes, slRes] = await Promise.all([
        fetch("/api/admin/seasons-list"),
        fetch("/api/admin/leagues-list"),
        fetch("/api/admin/season-leagues"),
      ]);
      if (sRes.ok)  { const d = await sRes.json();  setSeasons(d.seasons ?? []);         setLinkSeasonId(d.seasons?.[0]?.id ?? ""); }
      if (lRes.ok)  { const d = await lRes.json();  setLeagues(d.leagues ?? []);         setLinkLeagueId(d.leagues?.[0]?.id ?? ""); }
      if (slRes.ok) { const d = await slRes.json(); setSeasonLeagues(d.seasonLeagues ?? []); }
    } finally { setLoading(false); }
  };

  // Trigger data load once authenticated
  useEffect(() => { if (authed) loadData(); }, [authed]);

  const createSeason = async () => {
    if (!newSeason.name || !newSeason.year) { showToast("Name and year required", "error"); return; }
    const res = await apiFetch("/api/admin/seasons", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSeason),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error || "Failed", "error"); return; }
    showToast("Season created!");
    setNewSeason({ name: "", year: "" });
    loadData();
  };

  const createLeague = async () => {
    if (!newLeague.name) { showToast("League name required", "error"); return; }
    const res = await apiFetch("/api/admin/leagues", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newLeague, seasonId: linkSeasonId }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error || "Failed", "error"); return; }
    showToast("League created and linked!");
    setNewLeague({ name: "", organizer: "", level: "" });
    loadData();
  };

  const linkLeague = async () => {
    if (!linkLeagueId || !linkSeasonId) return;
    const res = await apiFetch("/api/admin/seasons", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:      seasons.find(s => s.id === linkSeasonId)?.name,
        year:      seasons.find(s => s.id === linkSeasonId)?.year,
        leagueIds: [linkLeagueId],
      }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error || "Failed", "error"); return; }
    showToast("League linked to season!");
    loadData();
  };

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
    <AdminLayout slug={slug} title="Seasons" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <div className="text-[20px] font-black text-ak-text mb-6">Seasons & leagues</div>

      {loading ? (
        <div className="flex justify-center py-[60px]"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">

          {/* Active season leagues */}
          <div>
            <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-3 uppercase">Active season leagues</div>
            <div className="flex flex-col gap-[6px] mb-5">
              {seasonLeagues.length === 0
                ? <div className="text-xs text-ak-text-dim">No leagues linked yet.</div>
                : seasonLeagues.map(sl => (
                  <div key={sl.id} className="py-[10px] px-[14px] rounded-[9px] border border-ak-border bg-ak-surface2">
                    <div className="font-black text-[13px] text-ak-text">{sl.leagueName}</div>
                    <div className="text-[11px] text-ak-text-dim">{sl.seasonName} · {sl.leagueSlug}</div>
                  </div>
                ))
              }
            </div>

            <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[10px] uppercase">Link existing league to season</div>
            <div className="grid grid-cols-2 gap-2 mb-[10px]">
              <Sel label="Season" value={linkSeasonId} onChange={setLinkSeasonId} options={seasons.map(s => ({ value: s.id, label: s.name }))} />
              <Sel label="League" value={linkLeagueId} onChange={setLinkLeagueId} options={leagues.map(l => ({ value: l.id, label: l.name }))} />
            </div>
            <Btn onClick={linkLeague} disabled={!linkSeasonId || !linkLeagueId}>LINK</Btn>
          </div>

          {/* Create season + league */}
          <div>
            <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-3 uppercase">Create new season</div>
            <div className="flex flex-col gap-2 mb-[10px]">
              <F label="Name" value={newSeason.name} onChange={(v: any) => setNewSeason((s: any) => ({ ...s, name: v }))} placeholder="e.g. 2026-27" />
              <F label="Year" value={newSeason.year} onChange={(v: any) => setNewSeason((s: any) => ({ ...s, year: v }))} type="number" placeholder="e.g. 2026" />
            </div>
            <Btn onClick={createSeason} disabled={!newSeason.name || !newSeason.year}>CREATE SEASON</Btn>

            <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mt-6 mb-3 uppercase">Create new league</div>
            <div className="flex flex-col gap-2 mb-[10px]">
              <F label="Name"      value={newLeague.name}      onChange={(v: any) => setNewLeague((l: any) => ({ ...l, name: v }))}      placeholder="e.g. BC6" />
              <F label="Organizer" value={newLeague.organizer} onChange={(v: any) => setNewLeague((l: any) => ({ ...l, organizer: v }))} placeholder="e.g. Basket City" />
              <F label="Level"     value={newLeague.level}     onChange={(v: any) => setNewLeague((l: any) => ({ ...l, level: v }))}     placeholder="e.g. Amateur" />
              <Sel label="Link to season" value={linkSeasonId} onChange={setLinkSeasonId} options={seasons.map(s => ({ value: s.id, label: s.name }))} />
            </div>
            <Btn onClick={createLeague} disabled={!newLeague.name}>CREATE LEAGUE</Btn>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export async function getServerSideProps({ params }: any) {
  if (!await validateAdminSlug(params.slug)) return { notFound: true };
  return { props: { validSlug: true } };
}
