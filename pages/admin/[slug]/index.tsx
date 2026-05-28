/**
 * pages/admin/[slug]/index.js
 * Dashboard -- loads only aggregate stats. Fast.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { AdminLayout, Spinner, PasskeyLoginForm, useAdminAuth, apiFetch } from "@/client/admin";
import type { DashboardData } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";

export default function AdminDashboard({ validSlug, showFallback, noPasskeys }: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  // A-02 fix: derive slug from the Next.js router, not window.location.
  // router.query is {} on first render; fall back to validSlug (from SSR props)
  // so the auth hook has a non-empty slug immediately.
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  // Q-03 fix: use the shared hook instead of inline auth state.
  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } =
    useAdminAuth(slug);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState<{ type?: string; msg: string } | null>(null);
  const [recalcing, setRecalcing] = useState(false);
  const [maintenanceOn, setMaintenanceOn] = useState<boolean | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [seasonPhase, setSeasonPhase] = useState<string | null>(null);
  const [phaseBusy, setPhaseBusy] = useState(false);
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

  const handleToggleMaintenance = async () => {
    if (maintenanceOn === null) return;
    const next = !maintenanceOn;
    setMaintenanceBusy(true);
    try {
      const res = await apiFetch("/api/admin/maintenance", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ enabled: next }),
      });
      const json = await res.json();
      if (res.ok) {
        setMaintenanceOn(json.enabled);
        setToast({
          type: "success",
          msg:  json.enabled ? "Maintenance mode ON" : "Maintenance mode OFF",
        });
      } else {
        setToast({ type: "error", msg: json.error ?? "Toggle failed" });
      }
    } catch {
      setToast({ type: "error", msg: "Toggle failed" });
    } finally {
      setMaintenanceBusy(false);
    }
  };

  const handleSetPhase = async (phase: string) => {
    if (phase === seasonPhase) return;
    setPhaseBusy(true);
    try {
      const res = await apiFetch("/api/admin/season-phase", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phase }),
      });
      const json = await res.json();
      if (res.ok) {
        setSeasonPhase(json.seasonPhase);
        const labels: Record<string, string> = {
          regular: "Regular Season", quarterfinal: "Quarterfinals",
          semifinal: "Semifinals", final: "Finals",
        };
        setToast({ type: "success", msg: `Phase set to ${labels[json.seasonPhase] ?? json.seasonPhase}` });
      } else {
        setToast({ type: "error", msg: json.error ?? "Failed to set phase" });
      }
    } catch {
      setToast({ type: "error", msg: "Failed to set phase" });
    } finally {
      setPhaseBusy(false);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, maintRes, phaseRes] = await Promise.all([
        fetch("/api/admin/dashboard"),
        apiFetch("/api/admin/maintenance"),
        apiFetch("/api/admin/season-phase"),
      ]);
      if (dashRes.ok)  setData(await dashRes.json());
      if (maintRes.ok) setMaintenanceOn((await maintRes.json()).enabled);
      if (phaseRes.ok) setSeasonPhase((await phaseRes.json()).seasonPhase);
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
        <PasskeyLoginForm onPasskeyLogin={handlePasskeyLogin} onFallbackLogin={handleLogin} loginError={loginError} showFallback={showFallback} noPasskeys={noPasskeys} />
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
    { href: `/admin/${slug}/import`,      label: "Import game",   icon: "↓", desc: "Add a new game from sportstats.gr" },
    { href: `/admin/${slug}/games`,       label: "Game results",  icon: "◉", desc: `${data?.totalGames ?? "--"} games recorded` },
    { href: `/admin/${slug}/roster`,      label: "Roster",        icon: "◎", desc: `${data?.totalPlayers ?? "--"} players` },
    { href: `/admin/${slug}/seasons`,     label: "Seasons",       icon: "◇", desc: `${data?.totalSeasonLeagues ?? "--"} active leagues` },
    { href: `/admin/${slug}/subscribers`, label: "Subscribers",   icon: "✉", desc: "Manage subscriber list" },
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
            ].map(([label, value]) => (
              <div key={label} className="rounded-[10px] px-[14px] py-3 text-center border border-ak-border bg-ak-surface">
                <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-1">{label}</div>
                <div className={["font-black", label === "SEASON" ? "text-[14px] text-ak-red-text" : "text-[22px] text-ak-text"].join(" ")}>{value}</div>
              </div>
            ))}
          </div>

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
          <div className="mb-3">
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

          {/* Maintenance toggle */}
          <div className="mb-7">
            <button
              onClick={handleToggleMaintenance}
              disabled={maintenanceBusy || maintenanceOn === null}
              className={[
                "py-[10px] px-[18px] text-[12px] font-black tracking-[0.08em] rounded-[9px] border font-sans inline-flex items-center gap-[10px]",
                maintenanceOn
                  ? "border-[#8b1a1a55] bg-[#8b1a1a22] text-ak-red-text"
                  : "border-ak-border bg-ak-surface text-ak-text",
                (maintenanceBusy || maintenanceOn === null) ? "cursor-not-allowed opacity-70" : "cursor-pointer",
              ].join(" ")}
            >
              <span
                className={[
                  "h-2 w-2 rounded-full",
                  maintenanceOn === null
                    ? "bg-ak-text-dim"
                    : maintenanceOn
                    ? "bg-ak-red-bright animate-ak-pulse"
                    : "bg-ak-green",
                ].join(" ")}
              />
              {maintenanceBusy
                ? "Switching..."
                : maintenanceOn === null
                ? "Maintenance: ..."
                : maintenanceOn
                ? "Maintenance: ON -- Click to disable"
                : "Maintenance: OFF -- Click to enable"}
            </button>
            <span className="text-[11px] text-ak-text-dim ml-[10px]">
              Redirects all non-admin visitors to /maintenance
            </span>
          </div>

          {/* Season Phase */}
          <div className="mb-7">
            <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-2 uppercase">
              Season Phase
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: "regular",      label: "Regular Season" },
                { value: "quarterfinal", label: "Quarterfinal"   },
                { value: "semifinal",    label: "Semifinal"      },
                { value: "final",        label: "Final"          },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleSetPhase(value)}
                  disabled={phaseBusy || seasonPhase === null}
                  className={[
                    "py-[8px] px-[14px] text-[11px] font-black tracking-[0.06em] rounded-[9px] border font-sans transition-colors duration-150",
                    seasonPhase === value
                      ? "border-[#8b1a1a55] bg-[#8b1a1a22] text-ak-red-text"
                      : "border-ak-border bg-ak-surface text-ak-text",
                    (phaseBusy || seasonPhase === null) ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-ak-text-dim mt-1 block">
              Updates the hero label and page headings across the public site
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
export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
