import { useState, useEffect, type ReactNode } from "react";
import { adminLayout, useAdminSession, Spinner, Segmented, Sel, Btn, apiFetch } from "@/client/admin";
import type { GetServerSidePropsContext } from "next";
import { getAdminPageProps } from "@/server/auth";

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

const ON_OFF = [{ value: "off", label: "Off" }, { value: "on", label: "On" }] as const;
const POPUP_ROUNDS = [{ value: "semifinal", label: "Semifinals (F4)" }, { value: "final", label: "Finals" }] as const;

export default function MaintenancePage() {
  const { setToast } = useAdminSession();

  const [maintenanceOn,   setMaintenanceOn]   = useState<boolean | null>(null);
  const [seasonPhase,     setSeasonPhase]     = useState<string | null>(null);
  const [popupEnabled,    setPopupEnabled]    = useState<boolean | null>(null);
  const [popupRound,      setPopupRound]      = useState<"semifinal" | "final" | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [phaseBusy,       setPhaseBusy]       = useState(false);
  const [popupBusy,       setPopupBusy]       = useState(false);
  const [roundBusy,       setRoundBusy]       = useState(false);
  const [recalcing,       setRecalcing]       = useState(false);
  const [testingAlert,    setTestingAlert]    = useState(false);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [m, p, pc] = await Promise.all([
          apiFetch("/api/admin/maintenance"),
          apiFetch("/api/admin/season-phase"),
          apiFetch("/api/admin/popup-config"),
        ]);
        if (m.ok)  setMaintenanceOn((await m.json()).enabled);
        if (p.ok)  setSeasonPhase((await p.json()).seasonPhase);
        if (pc.ok) { const d = await pc.json(); setPopupEnabled(d.enabled); setPopupRound(d.round ?? "semifinal"); }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

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
    if (phaseBusy || phase === seasonPhase) return;
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

  const handleTogglePopup = async () => {
    if (popupEnabled === null) return;
    const next = !popupEnabled;
    setPopupBusy(true);
    try {
      const res = await apiFetch("/api/admin/popup-config", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ enabled: next }),
      });
      const json = await res.json();
      if (res.ok) {
        setPopupEnabled(json.enabled);
        setToast({ type: "success", msg: json.enabled ? "Playoff popup ON" : "Playoff popup OFF" });
      } else {
        setToast({ type: "error", msg: json.error ?? "Toggle failed" });
      }
    } catch {
      setToast({ type: "error", msg: "Toggle failed" });
    } finally {
      setPopupBusy(false);
    }
  };

  const handleSetPopupRound = async (round: "semifinal" | "final") => {
    if (round === popupRound) return;
    setRoundBusy(true);
    try {
      const res = await apiFetch("/api/admin/popup-config", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ round }),
      });
      const json = await res.json();
      if (res.ok) {
        setPopupRound(json.round);
        setToast({ type: "success", msg: round === "final" ? "Popup: Finals" : "Popup: Semifinals (F4)" });
      } else {
        setToast({ type: "error", msg: json.error ?? "Failed" });
      }
    } catch {
      setToast({ type: "error", msg: "Failed" });
    } finally {
      setRoundBusy(false);
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

  const handleTestAlert = async () => {
    setTestingAlert(true);
    try {
      const res  = await apiFetch("/api/admin/test-alert", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setToast({ type: "error", msg: json.error ?? "Test alert failed" });
      } else if (json.via === "none") {
        // Not an error on the request, but the answer the admin needs: nothing
        // would carry an alert if the poll raised one right now.
        setToast({ type: "error", msg: "No alert channel is configured" });
      } else {
        setToast({ type: "success", msg: `Test alert delivered via ${json.via}` });
      }
    } catch {
      setToast({ type: "error", msg: "Test alert failed" });
    } finally {
      setTestingAlert(false);
    }
  };

  return (
    <>
      <h1 className="text-[22px] md:text-[28px] font-black text-ak-text mb-6">Maintenance</h1>

      {loading ? (
        <div className="flex justify-center py-[60px]"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-6">
          <Section
            label="Maintenance mode"
            hint="Redirects all non-admin visitors to /maintenance."
          >
            {maintenanceOn === null ? <NotLoaded /> : (
              <Segmented
                label="Maintenance mode"
                options={ON_OFF}
                value={maintenanceOn ? "on" : "off"}
                disabled={maintenanceBusy}
                onChange={v => { if ((v === "on") !== maintenanceOn) void handleToggleMaintenance(); }}
              />
            )}
          </Section>

          <Section
            label="Season phase"
            hint="Updates the hero label and page headings across the public site."
          >
            {seasonPhase === null ? <NotLoaded /> : (
              <div className="max-w-[320px]">
                <Sel label="PHASE" value={seasonPhase} onChange={v => void handleSetPhase(v)} options={PHASES} />
              </div>
            )}
          </Section>

          <Section
            label="Playoff popup"
            hint="Shows a one-time announcement popup to visitors. Each time you re-enable it the dismissal counter resets, so returning visitors see it again."
          >
            {popupEnabled === null || popupRound === null ? <NotLoaded /> : (
              <div className="flex flex-col gap-3">
                <Segmented
                  label="Playoff popup"
                  options={ON_OFF}
                  value={popupEnabled ? "on" : "off"}
                  disabled={popupBusy}
                  onChange={v => { if ((v === "on") !== popupEnabled) void handleTogglePopup(); }}
                />
                <Segmented
                  label="Popup round"
                  options={POPUP_ROUNDS}
                  value={popupRound}
                  disabled={roundBusy}
                  onChange={v => void handleSetPopupRound(v)}
                />
              </div>
            )}
          </Section>

          <Section
            label="Recalculate stats"
            hint="Recomputes all player season aggregates from raw game data. Safe to run after manual edits."
          >
            <Btn variant="ghost" onClick={handleRecalc} disabled={recalcing}>
              {recalcing ? "RECALCULATING..." : "RECALC STATS"}
            </Btn>
          </Section>

          <Section
            label="Test the import alert"
            hint="Sends a notification through the path the nightly import uses and reports whether it went to Slack or email. Nothing is imported and no game data changes."
          >
            <Btn variant="ghost" onClick={handleTestAlert} disabled={testingAlert}>
              {testingAlert ? "SENDING..." : "SEND TEST ALERT"}
            </Btn>
          </Section>
        </div>
      )}
    </>
  );
}

MaintenancePage.getLayout = adminLayout("Maintenance");

function NotLoaded() {
  return <div className="text-[12px] text-ak-text-dim">Could not load. Reload the page to try again.</div>;
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

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return getAdminPageProps(ctx);
}
