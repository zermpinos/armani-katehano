/**
 * pages/admin/[slug]/index.js
 * Dashboard -- loads only aggregate stats. Fast.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { AdminLayout, Spinner, LoginForm, useAdminAuth, apiFetch } from "@/client/admin";
import type { DashboardData } from "@/client/admin";
import { validateAdminSlug } from "@/server/auth";

export default function AdminDashboard({ validSlug }: { validSlug: boolean }) {
  // A-02 fix: derive slug from the Next.js router, not window.location.
  // router.query is {} on first render; fall back to validSlug (from SSR props)
  // so the auth hook has a non-empty slug immediately.
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  // Q-03 fix: use the shared hook instead of inline auth state.
  const { authed, loading: authLoading, loginError, handleLogin, handleLogout } =
    useAdminAuth(slug);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState<{ type?: string; msg: string } | null>(null);
  const [recalcing, setRecalcing] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [subscribers, setSubscribers] = useState<{ email: string; createdAt: string }[]>([]);
  const [showSubscribers, setShowSubscribers] = useState(false);

  const handleRecalc = async () => {
    setRecalcing(true);
    try {
      const res = await apiFetch("/api/admin/recalc", { method: "POST" });
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
      if (subRes.ok) { const s = await subRes.json(); setSubscriberCount(s.count ?? 0); setSubscribers(s.subscribers ?? []); }
    } finally {
      setLoading(false);
    }
  };

  // Guard: don't fetch until the router has hydrated and auth is confirmed.
  useEffect(() => {
    if (authed && slug) loadDashboard();
  }, [authed, slug]);

  // ── 404 ───────────────────────────────────────────────────────────────────
  if (!validSlug) return null;

  // ── Auth loading ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ak-base">
        <Spinner />
      </div>
    );
  }

  // ── Not authed -> Login screen ─────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ak-base p-4">
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
        <div className="flex justify-center py-[60px]">
          <Spinner />
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-[10px] mb-7">
            {[
              ["SEASON",      data?.currentSeason ?? "--"],
              ["RECORD",      `${wins}-${losses}`],
              ["PPG",         ppg],
              ["RPG",         rpg],
              ["APG",         apg],
              ["SUBSCRIBERS", subscriberCount !== null ? String(subscriberCount) : "--"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[10px] px-[14px] py-3 text-center border border-ak-border bg-ak-surface">
                <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-1">{label}</div>
                <div className={["font-black", label === "SEASON" ? "text-[14px] text-ak-red-text" : "text-[22px] text-ak-text"].join(" ")}>{value}</div>
              </div>
            ))}
          </div>

          {/* Subscriber list */}
          {subscribers.length > 0 && (
            <div className="mb-7">
              <button
                onClick={() => setShowSubscribers(v => !v)}
                className={["flex items-center gap-2 bg-transparent border-0 cursor-pointer p-0", showSubscribers ? "mb-[10px]" : "mb-0"].join(" ")}
              >
                <span className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase">
                  Subscriber emails
                </span>
                <span className="text-[10px] text-ak-text-dim">{showSubscribers ? "▲" : "▼"}</span>
              </button>
              {showSubscribers && (
                <div className="border border-ak-border rounded-[10px] overflow-hidden">
                  {subscribers.map((s, i) => (
                    <div
                      key={s.email}
                      className={[
                        "flex justify-between items-center py-[9px] px-[14px]",
                        i % 2 === 0 ? "bg-ak-surface" : "bg-ak-surface2",
                        i === 0 ? "" : "border-t border-ak-border",
                      ].join(" ")}
                    >
                      <span className="text-[13px] text-ak-text font-mono">{s.email}</span>
                      <span className="text-[11px] text-ak-text-dim whitespace-nowrap ml-4">
                        {s.createdAt?.slice(0, 10)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-7">
            {navItems.map(link => (
              <Link key={link.href} href={link.href} className="block rounded-xl px-5 py-[18px] border border-ak-border bg-ak-surface">
                <div className="text-[20px] mb-2">{link.icon}</div>
                <div className="text-[13px] font-black text-ak-text mb-[3px]">{link.label}</div>
                <div className="text-[11px] text-ak-text-dim">{link.desc}</div>
              </Link>
            ))}
          </div>

          {/* Recalc */}
          <div className="mb-7">
            <button
              onClick={handleRecalc}
              disabled={recalcing}
              className={[
                "py-[10px] px-[18px] text-[12px] font-black tracking-[0.08em] rounded-[9px] border border-ak-border bg-ak-surface font-sans",
                recalcing ? "text-ak-text-dim cursor-not-allowed" : "text-ak-text cursor-pointer",
              ].join(" ")}
            >
              {recalcing ? "Recalculating..." : "⟳ Recalc stats"}
            </button>
            <span className="text-[11px] text-ak-text-dim ml-[10px]">
              Recomputes all player aggregates from raw game data
            </span>
          </div>

          {/* Recent games */}
          {data?.recentGames && data.recentGames.length > 0 && (
            <div>
              <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[10px] uppercase">
                Recent games
              </div>
              <div className="flex flex-col gap-[6px]">
                {data.recentGames.map(g => (
                  <div key={g.id} className="flex justify-between items-center py-[10px] px-[14px] rounded-[9px] border border-ak-border bg-ak-surface">
                    <div className="flex items-center gap-[10px]">
                      <span className={[
                        "px-2 py-[2px] rounded-[5px] text-[11px] font-black",
                        g.result === "W" ? "bg-[#4caf7d22] text-ak-green" : "bg-[#8b1a1a22] text-ak-red-text",
                      ].join(" ")}>
                        {g.result}
                      </span>
                      <span className="text-[13px] font-bold text-ak-text">
                        {g.opponent}
                      </span>
                      <span className="text-[12px] text-ak-text-dim">{g.teamScore}-{g.opponentScore}</span>
                    </div>
                    <span className="text-[11px] text-ak-text-dim">{g.playedOn?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-[10px]">
                <Link href={`/admin/${slug}/games`} className="text-[11px] text-ak-red-text font-bold">
                  View all games ->
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}

// ── SSR slug validation ─────────────────────────────────────────────────────
export async function getServerSideProps({ params }: { params: { slug: string } }) {
  const validSlug = await validateAdminSlug(params.slug);
  if (!validSlug) return { notFound: true };
  return { props: { validSlug } };
}
