import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { AdminLayout, Spinner, PasskeyLoginForm, useAdminAuth } from "@/client/admin";
import type { DashboardData, ScheduledGame } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";
import { fmtDate } from "@/domain/shared/format";

export default function AdminDashboard({
  validSlug, showFallback, noPasskeys,
}: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [data,     setData]     = useState<DashboardData | null>(null);
  const [upcoming, setUpcoming] = useState<ScheduledGame[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState<{ type?: string; msg: string } | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, schedRes] = await Promise.all([
        fetch("/api/admin/dashboard"),
        fetch("/api/admin/schedule"),
      ]);
      if (dashRes.ok) setData(await dashRes.json());
      if (schedRes.ok) {
        const d = await schedRes.json();
        const now = Date.now();
        const next = (d.schedule ?? [])
          .filter((g: ScheduledGame) => new Date(g.scheduledFor).getTime() >= now)
          .slice(0, 3);
        setUpcoming(next);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed && slug) loadDashboard();
  }, [authed, slug]);

  if (!validSlug) return null;

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base"><Spinner /></div>
  );

  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base p-4">
      <PasskeyLoginForm onPasskeyLogin={handlePasskeyLogin} onFallbackLogin={handleLogin} loginError={loginError} showFallback={showFallback} noPasskeys={noPasskeys} />
    </div>
  );

  const wins   = data?.record?.wins   ?? 0;
  const losses = data?.record?.losses ?? 0;
  const ppg    = data?.ppg ?? "-";
  const rpg    = data?.rpg ?? "-";
  const apg    = data?.apg ?? "-";

  const quickActions = [
    { href: `/admin/${slug}/import`,    label: "Import game",    icon: "↓", desc: "Paste a sportstats URL" },
    { href: `/admin/${slug}/schedule`,  label: "Schedule game",  icon: "+", desc: "Add an upcoming fixture" },
    { href: `/admin/${slug}/broadcast`, label: "Broadcast",      icon: "✉", desc: "Email all subscribers" },
  ];

  const fmtTime = (iso: string) => iso.slice(11, 16);

  return (
    <AdminLayout slug={slug} title="Dashboard" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <header className="mb-6">
        <h1 className="text-[22px] md:text-[28px] font-black text-ak-text">Overview</h1>
        {data?.currentSeason && (
          <div className="mt-1 text-[11px] font-black tracking-[0.12em] uppercase text-ak-red-text">
            {data.currentSeason}
          </div>
        )}
      </header>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section aria-label="Season stats" className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
            <StatTile label="Record" value={`${wins}-${losses}`} />
            <StatTile label="PPG"    value={ppg} />
            <StatTile label="RPG"    value={rpg} />
            <StatTile label="APG"    value={apg} />
          </section>

          <section aria-label="Quick actions" className="mb-7">
            <SectionLabel>Quick actions</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {quickActions.map(a => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="block rounded-xl px-4 py-4 border border-ak-border bg-ak-surface hover:border-ak-border2 transition-colors"
                >
                  <div className="text-[18px] mb-1.5">{a.icon}</div>
                  <div className="text-[13px] font-black text-ak-text mb-[2px]">{a.label}</div>
                  <div className="text-[11px] text-ak-text-dim">{a.desc}</div>
                </Link>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Panel
              title="Recent games"
              footer={data?.recentGames && data.recentGames.length > 0 ? (
                <Link href={`/admin/${slug}/games`} className="text-[11px] font-bold text-ak-red-text">
                  All games →
                </Link>
              ) : null}
            >
              {data?.recentGames && data.recentGames.length > 0 ? (
                <ul className="flex flex-col gap-[6px]">
                  {data.recentGames.map(g => (
                    <li key={g.id}>
                      <div className="flex flex-wrap items-center gap-2 py-[10px] px-[12px] rounded-[9px] border border-ak-border bg-ak-base">
                        <span
                          className={[
                            "px-2 py-[2px] rounded-[5px] text-[11px] font-black",
                            g.result === "W" ? "bg-[#4caf7d22] text-ak-green" : "bg-[#8b1a1a22] text-ak-red-text",
                          ].join(" ")}
                        >
                          {g.result}
                        </span>
                        <span className="text-[13px] font-bold text-ak-text flex-1 min-w-0 truncate">
                          {g.opponent}
                        </span>
                        <span className="text-[12px] text-ak-text-dim font-bold">
                          {g.teamScore}-{g.opponentScore}
                        </span>
                        <span className="text-[11px] text-ak-text-dim w-full md:w-auto">
                          {g.playedOn?.slice(0, 10)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  message="No games yet"
                  cta={{ href: `/admin/${slug}/import`, label: "Import the first one" }}
                />
              )}
            </Panel>

            <Panel
              title="Upcoming"
              footer={upcoming.length > 0 ? (
                <Link href={`/admin/${slug}/schedule`} className="text-[11px] font-bold text-ak-red-text">
                  Manage schedule →
                </Link>
              ) : null}
            >
              {upcoming.length > 0 ? (
                <ul className="flex flex-col gap-[6px]">
                  {upcoming.map(g => (
                    <li key={g.id}>
                      <div className="flex flex-wrap items-center gap-2 py-[10px] px-[12px] rounded-[9px] border border-ak-border bg-ak-base">
                        <span className="text-[11px] font-black tracking-[0.08em] text-ak-text-dim uppercase">
                          {g.location === "home" ? "vs" : "@"}
                        </span>
                        <span className="text-[13px] font-bold text-ak-text flex-1 min-w-0 truncate">
                          {g.opponent}
                        </span>
                        <span className="text-[11px] text-ak-text-dim w-full md:w-auto">
                          {fmtDate(g.scheduledFor)} {fmtTime(g.scheduledFor)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  message="Nothing scheduled"
                  cta={{ href: `/admin/${slug}/schedule`, label: "Add a fixture" }}
                />
              )}
            </Panel>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl px-4 py-4 text-center border border-ak-border bg-ak-surface">
      <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-1 uppercase">{label}</div>
      <div className="text-[24px] md:text-[28px] font-black text-ak-text leading-none">{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-2">
      {children}
    </div>
  );
}

function Panel({ title, footer, children }: { title: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ak-border bg-ak-surface p-4">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-1">{children}</div>
      {footer && <div className="mt-3">{footer}</div>}
    </section>
  );
}

function EmptyState({ message, cta }: { message: string; cta: { href: string; label: string } }) {
  return (
    <div className="py-6 text-center">
      <div className="text-[12px] text-ak-text-dim mb-2">{message}</div>
      <Link href={cta.href} className="text-[11px] font-black tracking-[0.1em] uppercase text-ak-red-text">
        {cta.label} →
      </Link>
    </div>
  );
}

function DashboardSkeleton() {
  const tileCls = "rounded-xl border border-ak-border bg-ak-surface h-[88px] animate-pulse";
  const rowCls  = "rounded-xl border border-ak-border bg-ak-surface h-[160px] animate-pulse";
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        <div className={tileCls} />
        <div className={tileCls} />
        <div className={tileCls} />
        <div className={tileCls} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
        <div className={tileCls} />
        <div className={tileCls} />
        <div className={tileCls} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className={rowCls} />
        <div className={rowCls} />
      </div>
    </>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
