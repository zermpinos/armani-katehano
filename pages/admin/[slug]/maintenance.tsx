import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import { AdminLayout, Spinner, PasskeyLoginForm, useAdminAuth, apiFetch } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";

const PHASES = [
  { value: "regular",      label: "Regular Season" },
  { value: "quarterfinal", label: "Quarterfinal"   },
  { value: "semifinal",    label: "Semifinal"      },
  { value: "final",        label: "Final"          },
];

const PHASE_TOAST_LABELS: Record<string, string> = {
  regular:      "Regular Season",
  quarterfinal: "Quarterfinals",
  semifinal:    "Semifinals",
  final:        "Finals",
};

export default function MaintenancePage({
  validSlug, showFallback, noPasskeys,
}: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [maintenanceOn,   setMaintenanceOn]   = useState<boolean | null>(null);
  const [seasonPhase,     setSeasonPhase]     = useState<string | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [phaseBusy,       setPhaseBusy]       = useState(false);
  const [recalcing,       setRecalcing]       = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [toast,           setToast]           = useState<{ type?: string; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([
        apiFetch("/api/admin/maintenance"),
        apiFetch("/api/admin/season-phase"),
      ]);
      if (m.ok) setMaintenanceOn((await m.json()).enabled);
      if (p.ok) setSeasonPhase((await p.json()).seasonPhase);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed && slug) load();
  }, [authed, slug]);

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
        setToast({ type: "success", msg: json.enabled ? "Maintenance mode ON" : "Maintenance mode OFF" });
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
        const label = PHASE_TOAST_LABELS[json.seasonPhase] ?? json.seasonPhase;
        setToast({ type: "success", msg: `Phase set to ${label}` });
      } else {
        setToast({ type: "error", msg: json.error ?? "Failed to set phase" });
      }
    } catch {
      setToast({ type: "error", msg: "Failed to set phase" });
    } finally {
      setPhaseBusy(false);
    }
  };

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

  if (!validSlug) return null;

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base"><Spinner /></div>
  );

  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base p-4">
      <PasskeyLoginForm onPasskeyLogin={handlePasskeyLogin} onFallbackLogin={handleLogin} loginError={loginError} showFallback={showFallback} noPasskeys={noPasskeys} />
    </div>
  );

  return (
    <AdminLayout slug={slug} title="Maintenance" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <h1 className="text-[22px] md:text-[28px] font-black text-ak-text mb-6">Maintenance</h1>

      {loading ? (
        <div className="flex justify-center py-[60px]"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-6">
          <Section
            label="Maintenance mode"
            hint="Redirects all non-admin visitors to /maintenance."
          >
            <button
              onClick={handleToggleMaintenance}
              disabled={maintenanceBusy || maintenanceOn === null}
              className={[
                "w-full md:w-auto py-[10px] px-[18px] text-[12px] font-black tracking-[0.08em] rounded-[9px] border font-sans inline-flex items-center gap-[10px]",
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
                ? "Maintenance: ON - Click to disable"
                : "Maintenance: OFF - Click to enable"}
            </button>
          </Section>

          <Section
            label="Season phase"
            hint="Updates the hero label and page headings across the public site."
          >
            <div className="flex gap-1.5 flex-wrap">
              {PHASES.map(({ value, label }) => (
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
          </Section>

          <Section
            label="Recalculate stats"
            hint="Recomputes all player season aggregates from raw game data. Safe to run after manual edits."
          >
            <button
              onClick={handleRecalc}
              disabled={recalcing}
              className={[
                "w-full md:w-auto py-[10px] px-[18px] text-[12px] font-black tracking-[0.08em] rounded-[9px] border border-ak-border bg-ak-surface font-sans",
                recalcing ? "text-ak-text-dim cursor-not-allowed" : "text-ak-text cursor-pointer",
              ].join(" ")}
            >
              {recalcing ? "Recalculating..." : "⟳ Recalc stats"}
            </button>
          </Section>
        </div>
      )}
    </AdminLayout>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ak-border bg-ak-surface p-4 md:p-5">
      <div className="text-[10px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-1">{label}</div>
      {hint && <div className="text-[11px] text-ak-text-dim mb-3 leading-relaxed">{hint}</div>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
