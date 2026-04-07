/**
 * pages/admin/[slug]/seasons.js
 * Seasons & leagues management.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { C } from "../../../lib/theme";
import { AdminLayout, F, Sel, Btn, Spinner, LoginForm, useAdminAuth } from "../../../lib/adminShared";
import { validateAdminSlug } from '../../../lib/adminSlugCheck';

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
    const res = await fetch("/api/admin/seasons", {
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
    const res = await fetch("/api/admin/leagues", {
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
    const res = await fetch("/api/admin/seasons", {
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
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </div>
  );

  if (!authed) return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <LoginForm onLogin={handleLogin} error={loginError} />
    </div>
  );

  return (
    <AdminLayout slug={slug} title="Seasons" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 24 }}>Seasons & leagues</div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24 }}>

          {/* Active season leagues */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 12, textTransform: "uppercase" }}>Active season leagues</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
              {seasonLeagues.length === 0
                ? <div style={{ fontSize: 12, color: C.textDim }}>No leagues linked yet.</div>
                : seasonLeagues.map(sl => (
                  <div key={sl.id} style={{ padding: "10px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface2 }}>
                    <div style={{ fontWeight: 900, fontSize: 13, color: C.text }}>{sl.leagueName}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>{sl.seasonName} · {sl.leagueSlug}</div>
                  </div>
                ))
              }
            </div>

            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 10, textTransform: "uppercase" }}>Link existing league to season</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <Sel label="Season" value={linkSeasonId} onChange={setLinkSeasonId} options={seasons.map(s => ({ value: s.id, label: s.name }))} />
              <Sel label="League" value={linkLeagueId} onChange={setLinkLeagueId} options={leagues.map(l => ({ value: l.id, label: l.name }))} />
            </div>
            <Btn onClick={linkLeague} disabled={!linkSeasonId || !linkLeagueId}>LINK</Btn>
          </div>

          {/* Create season + league */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 12, textTransform: "uppercase" }}>Create new season</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              <F label="Name" value={newSeason.name} onChange={(v: any) => setNewSeason((s: any) => ({ ...s, name: v }))} placeholder="e.g. 2026-27" />
              <F label="Year" value={newSeason.year} onChange={(v: any) => setNewSeason((s: any) => ({ ...s, year: v }))} type="number" placeholder="e.g. 2026" />
            </div>
            <Btn onClick={createSeason} disabled={!newSeason.name || !newSeason.year}>CREATE SEASON</Btn>

            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, margin: "24px 0 12px", textTransform: "uppercase" }}>Create new league</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
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