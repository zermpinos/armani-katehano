/**
 * pages/coach/[token].tsx
 *
 * Coach portal — roster announcement management.
 * The [token] segment must match the COACH_TOKEN env var (validated server-side).
 * A wrong token returns 404, revealing nothing about the page's existence.
 *
 * Auth: separate COACH_PASSWORD + __Host-ak_coach session cookie.
 */
 
import React from "react";
import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { fmtDate } from "@/domain/shared/format";
import { Spinner, Btn } from "@/client/coach/primitives";
import { LoginForm } from "@/client/coach/login-form";
import { coachFetch } from "@/client/coach/csrf";
import { CoachRosterPanel } from "@/client/coach/roster-panel";
import { ChangePasswordForm } from "@/client/coach/change-password-form";

export default function CoachPage() {
  const [authed,     setAuthed]     = useState(false);
  const [checking,   setChecking]   = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; type?: string } | null>(null);

  const [schedule,         setSchedule]         = useState<any[]>([]);
  const [allPlayers,       setAllPlayers]        = useState<any[]>([]);
  const [loadingData,      setLoadingData]       = useState(false);
  const [announcedGameIds, setAnnouncedGameIds]  = useState<Set<string>>(new Set());

  // Roster panel
  const [panelGameId,  setPanelGameId]  = useState<string | null>(null);
  const [rosterSlots,  setRosterSlots]  = useState<Record<string, { checked: boolean; note: string }>>({});
  const [rosterMsg,    setRosterMsg]    = useState("");
  const [panelLoading, setPanelLoading] = useState(false);
  const [saving,       setSaving]       = useState(false);

  // Change password
  const [showChangePw,  setShowChangePw]  = useState(false);
  const [currentPw,     setCurrentPw]     = useState("");
  const [newPw,         setNewPw]         = useState("");
  const [confirmPw,     setConfirmPw]     = useState("");
  const [changingPw,    setChangingPw]    = useState(false);
  const [changePwError, setChangePwError] = useState<string | null>(null);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/coach/auth")
      .then(r => { if (r.ok) setAuthed(true); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = useCallback(async (password: string, captchaToken?: string | null) => {
    setLoginError(null);
    const res = await coachFetch("/api/coach/auth", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ password, captchaToken }),
    });
    if (res.ok) {
      setAuthed(true);
      return { failed: false };
    } else {
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setLoginError(`Too many attempts. Try again in ${Math.ceil((body.retryAfter || 900) / 60)} min.`);
      } else {
        setLoginError(body.error ?? "Invalid credentials.");
      }
      return { failed: true, requiresCaptcha: body.requiresCaptcha ?? false };
    }
  }, []);

  const handleLogout = useCallback(() => {
    coachFetch("/api/coach/auth", { method: "DELETE" }).finally(() => setAuthed(false));
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadPlayers = async () => {
    const res = await fetch("/api/coach/players");
    if (res.ok) {
      const d = await res.json();
      setAllPlayers(d.players ?? []);
    }
  };

  const loadAnnouncementBadges = async (games: any[]) => {
    if (games.length === 0) return;
    const results = await Promise.all(
      games.map(g =>
        fetch(`/api/coach/roster-announcement?upcomingGameId=${g.id}`)
          .then(r => r.json())
          .then(d => ({ id: g.id, has: !!d.announcement }))
          .catch(() => ({ id: g.id, has: false }))
      )
    );
    const ids = new Set(results.filter(r => r.has).map(r => r.id));
    setAnnouncedGameIds(ids);
  };

  const loadData = async () => {
    setLoadingData(true);
    try {
      const res = await fetch("/api/coach/schedule");
      if (res.ok) {
        const d = await res.json();
        const games = d.schedule ?? [];
        setSchedule(games);
        loadAnnouncementBadges(games);
      }
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (authed) {
      loadData();
      loadPlayers();
    }
    // loadData and loadPlayers only call state setters and fetch — they don't
    // close over any reactive value that would require them to be deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // ── Roster panel ──────────────────────────────────────────────────────────

  const openPanel = async (g: any) => {
    const slots: Record<string, { checked: boolean; note: string }> = {};
    allPlayers.forEach(p => { slots[p.id] = { checked: false, note: "" }; });
    setRosterSlots(slots);
    setRosterMsg("");
    setPanelGameId(g.id);
    setPanelLoading(true);

    try {
      const res = await fetch(`/api/coach/roster-announcement?upcomingGameId=${g.id}`);
      if (res.ok) {
        const { announcement } = await res.json();
        if (announcement) {
          setRosterMsg(announcement.message ?? "");
          const updated = { ...slots };
          announcement.players.forEach((sp: any) => {
            if (updated[sp.playerId] !== undefined) {
              updated[sp.playerId] = { checked: true, note: sp.note ?? "" };
            }
          });
          setRosterSlots(updated);
        }
      }
    } finally {
      setPanelLoading(false);
    }
  };

  const closePanel = () => {
    setPanelGameId(null);
    setRosterSlots({});
    setRosterMsg("");
  };

  const togglePlayer = (pid: string) => {
    // eslint-disable-next-line security/detect-object-injection
    setRosterSlots(prev => ({ ...prev, [pid]: { ...prev[pid], checked: !prev[pid].checked } }));
  };

  const setNote = (pid: string, note: string) => {
    // eslint-disable-next-line security/detect-object-injection
    setRosterSlots(prev => ({ ...prev, [pid]: { ...prev[pid], note } }));
  };

  const publish = async () => {
    const players = Object.entries(rosterSlots)
      .filter(([, v]) => v.checked)
      .map(([playerId, v]) => ({ playerId, note: v.note || null }));

    if (players.length === 0) { showToast("Select at least one player.", "error"); return; }

    setSaving(true);
    try {
      const res = await coachFetch("/api/coach/roster-announcement", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ upcomingGameId: panelGameId, message: rosterMsg || null, players }),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
      setAnnouncedGameIds(prev => new Set([...prev, panelGameId!]));
      showToast("Roster published!");
      closePanel();
    } finally { setSaving(false); }
  };

  const resendEmail = async () => {
    setSaving(true);
    try {
      const res = await coachFetch("/api/coach/roster-announcement", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ upcomingGameId: panelGameId, resend: true }),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
      showToast("Email resent to all subscribers!");
    } finally { setSaving(false); }
  };

  const removeAnnouncement = async () => {
    setSaving(true);
    try {
      const res = await coachFetch("/api/coach/roster-announcement", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ upcomingGameId: panelGameId }),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
      setAnnouncedGameIds(prev => { const s = new Set(prev); s.delete(panelGameId!); return s; });
      showToast("Roster announcement removed.");
      closePanel();
    } finally { setSaving(false); }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwError(null);
    if (newPw !== confirmPw) { setChangePwError("New passwords don't match."); return; }
    if (newPw.length < 8)    { setChangePwError("Password must be at least 8 characters."); return; }
    setChangingPw(true);
    try {
      const res = await coachFetch("/api/coach/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (res.ok) {
        // Session was cleared server-side — force re-login with the new password.
        showToast("Password updated. Please log in again.");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const d = await res.json().catch(() => ({}));
        setChangePwError(d.error ?? "Failed to change password.");
      }
    } finally { setChangingPw(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const fmtTime = (iso: string) => iso.slice(11, 16);
  const selectedCount = Object.values(rosterSlots).filter(v => v.checked).length;

  // ── Render guards ─────────────────────────────────────────────────────────

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

  // ── Authenticated UI ──────────────────────────────────────────────────────

  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <title>Coach Portal — Armani Katehano</title>
      </Head>

      {/* Header */}
      <div className="bg-ak-surface border-b border-ak-border sticky top-0 z-40">
        <div className="max-w-[780px] mx-auto px-4 flex items-center justify-between h-[52px]">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-black text-ak-red tracking-[0.1em] uppercase">AK</span>
            <span className="text-[11px] font-bold text-ak-text-dim tracking-[0.08em] uppercase">Coach Portal</span>
          </div>
          <button onClick={handleLogout} className="px-3 py-[5px] text-[10px] font-black tracking-[0.1em] uppercase bg-transparent border border-ak-border2 rounded-md text-ak-text-dim cursor-pointer">
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[780px] mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="text-[20px] font-black text-ak-text">Upcoming games</div>
          <div className="text-xs text-ak-text-dim mt-1">Select a game to announce or update the roster.</div>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-[60px]"><Spinner /></div>
        ) : schedule.length === 0 ? (
          <div className="text-center py-10 text-ak-text-dim">No upcoming games scheduled.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {schedule.map(g => (
              <div key={g.id}>
                <div className={[
                  "flex items-center justify-between flex-wrap gap-2 py-3 px-4 rounded-[10px] border transition-[border-color,background] duration-150",
                  panelGameId === g.id ? "border-[#4caf7d60] bg-[#4caf7d08]" : "border-ak-border bg-ak-surface2",
                ].join(" ")}>
                  <div className="flex-1 min-w-[180px]">
                    <div className="font-black text-[14px] text-ak-text flex items-center gap-2 flex-wrap">
                      {g.location === "home" ? "vs" : "@"} {g.opponent}
                      {announcedGameIds.has(g.id) && (
                        <span className="text-[9px] font-black tracking-[0.1em] uppercase px-[7px] py-[2px] rounded bg-[#4caf7d20] text-ak-green border border-[#4caf7d40]">
                          Roster set
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ak-text-dim mt-[3px]">
                      {fmtDate(g.scheduledFor)} · {fmtTime(g.scheduledFor)}
                      {g.competition && <> · {g.competition}</>}
                    </div>
                  </div>
                  <Btn size="sm" variant={panelGameId === g.id ? "ghost" : "primary"} onClick={() => panelGameId === g.id ? closePanel() : openPanel(g)}>
                    {panelGameId === g.id ? "CLOSE" : announcedGameIds.has(g.id) ? "EDIT ROSTER" : "SET ROSTER"}
                  </Btn>
                </div>

                {panelGameId === g.id && (
                  <div className="mt-1 rounded-[10px] border border-[#4caf7d40] p-5 bg-ak-base">
                    {panelLoading ? (
                      <div className="flex justify-center py-8"><Spinner /></div>
                    ) : (
                      <CoachRosterPanel
                        allPlayers={allPlayers}
                        rosterSlots={rosterSlots}
                        rosterMsg={rosterMsg}
                        onRosterMsgChange={setRosterMsg}
                        panelLoading={panelLoading}
                        saving={saving}
                        selectedCount={selectedCount}
                        isAnnounced={announcedGameIds.has(g.id)}
                        onTogglePlayer={togglePlayer}
                        onSetNote={setNote}
                        onPublish={publish}
                        onResendEmail={resendEmail}
                        onRemoveAnnouncement={removeAnnouncement}
                        onClose={closePanel}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="max-w-[780px] mx-auto px-4 pb-10">
        <div className="border-t border-ak-border pt-6">
          {!showChangePw ? (
            <button
              onClick={() => setShowChangePw(true)}
              className="bg-transparent border-0 text-[11px] text-ak-text-dim cursor-pointer p-0 font-sans font-bold tracking-[0.08em] uppercase"
            >
              Change password
            </button>
          ) : (
            <ChangePasswordForm
              currentPw={currentPw}   setCurrentPw={setCurrentPw}
              newPw={newPw}           setNewPw={setNewPw}
              confirmPw={confirmPw}   setConfirmPw={setConfirmPw}
              changingPw={changingPw}
              error={changePwError}
              onSubmit={changePassword}
              onCancel={() => { setShowChangePw(false); setChangePwError(null); }}
            />
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={[
          "fixed bottom-6 right-6 z-50 px-[18px] py-3 rounded-[10px] flex items-center gap-3 text-[13px] font-bold shadow-[0_4px_16px_rgba(0,0,0,0.25)]",
          toast.type === "error"
            ? "bg-[#8b1a1a22] text-ak-red-text border border-[#8b1a1a55]"
            : "bg-[#4caf7d22] text-ak-green border border-[#4caf7d55]",
        ].join(" ")}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="bg-transparent border-0 cursor-pointer text-[18px] text-current font-black leading-none p-0">×</button>
        </div>
      )}
    </>
  );
}

// ── Server-side: 404 if token doesn't match ───────────────────────────────────

export async function getServerSideProps({ params }: any) {
  const { isValidCoachToken } = await import("@/server/auth");
  if (!isValidCoachToken(params.token ?? "")) {
    return { notFound: true };
  }
  return { props: {} };
}
