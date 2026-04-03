/**
 * pages/admin/[slug]/index.js
 * Dashboard — loads only aggregate stats. Fast.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { C } from "../../../lib/theme";
import { AdminLayout, Spinner, LoginForm, useAdminAuth } from "../../../lib/adminShared";
import { validateAdminSlug } from "../../../lib/adminSlugCheck";

export default function AdminDashboard({ validSlug }) {
  // A-02 fix: derive slug from the Next.js router, not window.location.
  // router.query is {} on first render; fall back to validSlug (from SSR props)
  // so the auth hook has a non-empty slug immediately.
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  // Q-03 fix: use the shared hook instead of inline auth state.
  const { authed, loading: authLoading, loginError, handleLogin, handleLogout } =
    useAdminAuth(slug);

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // Uses the existing /api/admin/data endpoint — no separate dashboard endpoint needed.
      const res = await fetch("/api/admin/data");
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  // Guard: don't fetch until the router has hydrated and auth is confirmed.
  useEffect(() => {
    if (authed && slug) loadDashboard();
  }, [authed, slug]);

  // ── 404 ───────────────────────────────────────────────────────────────────
  // validSlug is false when adminSlugCheck rejects the URL segment.
  // getServerSideProps returns { notFound: true } so Next.js renders its own
  // 404 page — this branch is a belt-and-suspenders fallback only.
  if (!validSlug) return null;

  // ── Auth loading ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.base }}>
        <Spinner />
      </div>
    );
  }

  // ── Not authed → Login screen ─────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.base, padding: 16 }}>
        <LoginForm onLogin={handleLogin} error={loginError} />
      </div>
    );
  }

  // ── Derived display values ────────────────────────────────────────────────
  const wins   = data?.record?.wins   ?? 0;
  const losses = data?.record?.losses ?? 0;

  // Compute team-wide averages from the stats map returned by /api/admin/data.
  // statsMap is { [playerId]: { ppg, rpg, apg, gp, ... } }.
  const statValues = data?.stats ? Object.values(data.stats) : [];
  const totalGp    = statValues.reduce((s, p) => s + (p.gp || 0), 0);
  const wavg = key => totalGp > 0
    ? (statValues.reduce((s, p) => s + (p[key] || 0) * (p.gp || 0), 0) / totalGp).toFixed(1)
    : "—";

  const navItems = [
    { href: `/admin/${slug}/import`,  label: "Import game",   icon: "↓", desc: "Add a new game from sportstats.gr" },
    { href: `/admin/${slug}/game-stats`,   label: "Game results",  icon: "◉", desc: `${data?.games?.length ?? "—"} games recorded` },
    { href: `/admin/${slug}/roster`,  label: "Roster",        icon: "◎", desc: `${data?.players?.length ?? "—"} players` },
    { href: `/admin/${slug}/seasons`, label: "Seasons",       icon: "◇", desc: `${data?.seasonLeagues?.length ?? "—"} active leagues` },
  ];

  return (
    <AdminLayout slug={slug} title="Dashboard" toast={toast} setToast={setToast} onLogout={handleLogout}>
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Spinner />
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginBottom: 28 }}>
            {[
              ["SEASON",  data?.currentSeason ?? "—"],
              ["RECORD",  `${wins}–${losses}`],
              ["PPG",     wavg("ppg")],
              ["RPG",     wavg("rpg")],
              ["APG",     wavg("apg")],
            ].map(([label, value]) => (
              <div key={label} style={{ borderRadius: 10, padding: "12px 14px", textAlign: "center", border: `1px solid ${C.border}`, background: C.surface }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: label === "SEASON" ? 14 : 22, fontWeight: 900, color: label === "SEASON" ? C.redText : C.text }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 28 }}>
            {navItems.map(link => (
              <a key={link.href} href={link.href} style={{ display: "block", borderRadius: 12, padding: "18px 20px", border: `1px solid ${C.border}`, background: C.surface, textDecoration: "none" }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{link.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: C.text, marginBottom: 3 }}>{link.label}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{link.desc}</div>
              </a>
            ))}
          </div>

          {/* Recent games */}
          {data?.games?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 10, textTransform: "uppercase" }}>
                Recent games
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[...data.games]
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .slice(0, 5)
                  .map(g => (
                    <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 900, background: g.result === "W" ? `${C.green}22` : `${C.red}22`, color: g.result === "W" ? C.green : C.redText }}>
                          {g.result}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                          {g.home ? "vs" : "@"} {g.opponent}
                        </span>
                        <span style={{ fontSize: 12, color: C.textDim }}>{g.score}</span>
                      </div>
                      <span style={{ fontSize: 11, color: C.textDim }}>{g.date}</span>
                    </div>
                  ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <a href={`/admin/${slug}/game-stats`} style={{ fontSize: 11, color: C.redText, fontWeight: 700, textDecoration: "none" }}>
                  View all games →
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}

// ── SSR slug validation ─────────────────────────────────────────────────────
export async function getServerSideProps({ params }) {
  const validSlug = await validateAdminSlug(params.slug);
  // Return notFound so Next.js renders its built-in 404 page for bad slugs,
  // rather than mounting the component with validSlug = false.
  if (!validSlug) return { notFound: true };
  return { props: { validSlug } };
}