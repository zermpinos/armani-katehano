/**
 * pages/admin/[slug]/index.js
 * Dashboard -- loads only aggregate stats. Fast.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { C } from "../../../lib/theme";
import { AdminLayout, Spinner, LoginForm, useAdminAuth } from "../../../lib/adminShared";
import { validateAdminSlug } from "../../../lib/adminSlugCheck";

export default function AdminDashboard({ validSlug }: any) {
  // A-02 fix: derive slug from the Next.js router, not window.location.
  // router.query is {} on first render; fall back to validSlug (from SSR props)
  // so the auth hook has a non-empty slug immediately.
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  // Q-03 fix: use the shared hook instead of inline auth state.
  const { authed, loading: authLoading, loginError, handleLogin, handleLogout } =
    useAdminAuth(slug);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState<{ type: string; msg: string } | null>(null);
  const [recalcing, setRecalcing] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  const handleRecalc = async () => {
    setRecalcing(true);
    try {
      const res = await fetch("/api/admin/recalc", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setToast({ type: "success", msg: `Recalculated ${json.recalculated} league(s)` });
      } else {
        setToast({ type: "error", msg: json.error ?? "Recalc failed" });
      }
    } catch {
      setToast({ type: "error", msg: "Recalc failed" });
    } finally {
      setRecalcing(false);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, subRes] = await Promise.all([
        fetch("/api/admin/dashboard"),
        fetch("/api/admin/subscribers"),
      ]);
      if (dashRes.ok) setData(await dashRes.json());
      if (subRes.ok) { const s = await subRes.json(); setSubscriberCount(s.count ?? 0); }
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
  // 404 page -- this branch is a belt-and-suspenders fallback only.
  if (!validSlug) return null;

  // ── Auth loading ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.base }}>
        <Spinner />
      </div>
    );
  }

  // ── Not authed -> Login screen ─────────────────────────────────────────────
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

  // /api/admin/dashboard returns pre-computed ppg/rpg/apg
  const ppg = data?.ppg ?? "--";
  const rpg = data?.rpg ?? "--";
  const apg = data?.apg ?? "--";

  const navItems = [
    { href: `/admin/${slug}/import`,  label: "Import game",   icon: "↓", desc: "Add a new game from sportstats.gr" },
    { href: `/admin/${slug}/games`,   label: "Game results",  icon: "◉", desc: `${data?.totalGames ?? "--"} games recorded` },
    { href: `/admin/${slug}/roster`,  label: "Roster",        icon: "◎", desc: `${data?.totalPlayers ?? "--"} players` },
    { href: `/admin/${slug}/seasons`, label: "Seasons",       icon: "◇", desc: `${data?.totalSeasonLeagues ?? "--"} active leagues` },
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
              ["SEASON",      data?.currentSeason ?? "--"],
              ["RECORD",      `${wins}-${losses}`],
              ["PPG",         ppg],
              ["RPG",         rpg],
              ["APG",         apg],
              ["SUBSCRIBERS", subscriberCount !== null ? String(subscriberCount) : "--"],
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

          {/* Recalc */}
          <div style={{ marginBottom: 28 }}>
            <button
              onClick={handleRecalc}
              disabled={recalcing}
              style={{
                padding: "10px 18px", fontSize: 12, fontWeight: 900, letterSpacing: "0.08em",
                borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface,
                color: recalcing ? C.textDim : C.text, cursor: recalcing ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {recalcing ? "Recalculating..." : "⟳ Recalc stats"}
            </button>
            <span style={{ fontSize: 11, color: C.textDim, marginLeft: 10 }}>
              Recomputes all player aggregates from raw game data
            </span>
          </div>

          {/* Recent games */}
          {data?.recentGames?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 10, textTransform: "uppercase" }}>
                Recent games
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.recentGames.map((g: any) => (
                    <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 900, background: g.result === "W" ? `${C.green}22` : `${C.red}22`, color: g.result === "W" ? C.green : C.redText }}>
                          {g.result}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                          {g.opponent}
                        </span>
                        <span style={{ fontSize: 12, color: C.textDim }}>{g.teamScore}-{g.opponentScore}</span>
                      </div>
                      <span style={{ fontSize: 11, color: C.textDim }}>{g.playedOn?.slice(0, 10)}</span>
                    </div>
                  ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <a href={`/admin/${slug}/games`} style={{ fontSize: 11, color: C.redText, fontWeight: 700, textDecoration: "none" }}>
                  View all games ->
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
export async function getServerSideProps({ params }: any) {
  const validSlug = await validateAdminSlug(params.slug);
  // Return notFound so Next.js renders its built-in 404 page for bad slugs,
  // rather than mounting the component with validSlug = false.
  if (!validSlug) return { notFound: true };
  return { props: { validSlug } };
}