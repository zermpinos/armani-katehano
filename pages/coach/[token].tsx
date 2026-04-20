/**
 * pages/coach/[token].tsx
 *
 * Coach portal -- roster announcement management.
 * The [token] segment must match the COACH_TOKEN env var (validated server-side).
 * A wrong token returns 404, revealing nothing about the page's existence.
 *
 * Auth: separate COACH_PASSWORD + __Host-ak_coach session cookie.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import { fmtDate } from "../../lib/utils";

// ─── Tiny shared primitives (no adminShared import -- keeps coach bundle isolated) ─

function Spinner({ size = 32 }: { size?: number }) {
  return (
    <div
      className="rounded-full border-2 border-ak-border2 border-t-ak-red-bright animate-ak-spin"
      style={{ width: size, height: size }}
    />
  );
}

const BTN_VARIANT: Record<string, string> = {
  primary:   "bg-ak-red border-transparent text-ak-text",
  danger:    "bg-[#7f1d1d] border-transparent text-ak-text",
  ghost:     "bg-transparent border-ak-border2 text-ak-text-sub",
  secondary: "bg-ak-surface2 border-transparent text-ak-text",
  green:     "bg-ak-green border-transparent text-ak-text",
};

const BTN_SIZE: Record<string, string> = {
  sm: "py-[6px] px-3 text-[11px]",
  md: "py-[9px] px-[18px] text-[13px]",
};

function Btn({ onClick, disabled = false, children, variant = "primary", size = "md" }: any) {
  return (
    <button onClick={onClick} disabled={disabled} className={[
      "font-black tracking-[0.12em] rounded-lg border font-sans transition-opacity duration-150",
      BTN_VARIANT[variant] ?? BTN_VARIANT.primary,
      BTN_SIZE[size] ?? BTN_SIZE.md,
      disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer opacity-100",
    ].join(" ")}>
      {children}
    </button>
  );
}

// ─── Turnstile widget ────────────────────────────────────────────────────────

function TurnstileWidget({ onVerified, onExpired }: { onVerified: (token: string) => void; onExpired: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  useEffect(() => {
    const render = () => {
      const ts = (window as any).turnstile;
      if (containerRef.current && ts && !widgetId.current) {
        widgetId.current = ts.render(containerRef.current, {
          sitekey: siteKey,
          callback: onVerified,
          "expired-callback": onExpired,
          theme: "dark",
        });
      }
    };

    if ((window as any).turnstile) {
      render();
    } else {
      const existing = document.getElementById("cf-turnstile-script");
      if (!existing) {
        const script = document.createElement("script");
        script.id = "cf-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        script.onload = render;
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", render);
      }
    }

    return () => {
      if (widgetId.current && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={containerRef} className="my-1" />;
}

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm({ onLogin, error }: { onLogin: (pw: string, captchaToken?: string | null) => Promise<{ failed: boolean; requiresCaptcha?: boolean } | void>; error: string | null }) {
  const [password,     setPassword]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const [failCount,    setFailCount]    = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const needsCaptcha = failCount >= 3;

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const result = await onLogin(password, captchaToken);
    if (result?.failed) setFailCount(c => c + 1);
    if (result?.requiresCaptcha) setCaptchaToken(null);
    setLoading(false);
  };

  return (
    <div className="w-full max-w-[360px] rounded-[20px] p-8 border border-ak-border bg-ak-surface">
      <div className="text-center mb-7">
        <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center mx-auto mb-3 text-[22px] bg-[#8b1a1a18] border border-[#8b1a1a45]">🏀</div>
        <div className="text-[22px] font-black text-ak-text">Coach Portal</div>
        <div className="text-xs text-ak-text-dim mt-1">Armani Katehano</div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-[14px]">
        <div>
          <label className="block text-[10px] font-black tracking-[0.15em] mb-[5px] text-ak-text-dim uppercase">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter coach password" autoFocus
            className="w-full py-[9px] px-3 text-[13px] rounded-lg border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none" />
        </div>
        {needsCaptcha && (
          <TurnstileWidget
            onVerified={setCaptchaToken}
            onExpired={() => setCaptchaToken(null)}
          />
        )}
        {error && <div className="text-xs text-ak-red-text">{error}</div>}
        <button type="submit" disabled={loading || !password || (needsCaptcha && !captchaToken)}
          className={[
            "py-3 font-black text-[14px] tracking-[0.12em] uppercase rounded-[10px] border-0 bg-ak-red text-ak-text font-sans",
            (loading || !password || (needsCaptcha && !captchaToken)) ? "opacity-50 cursor-not-allowed" : "cursor-pointer opacity-100",
          ].join(" ")}>
          {loading ? "VERIFYING..." : "SIGN IN"}
        </button>
      </form>
      <div className="text-center text-[10px] text-ak-text-dim mt-4">5 failed attempts -> 15-minute lockout</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
  const [panelGameId,   setPanelGameId]   = useState<string | null>(null);
  const [rosterSlots,   setRosterSlots]   = useState<Record<string, { checked: boolean; note: string }>>({});
  const [rosterMsg,     setRosterMsg]     = useState("");
  const [panelLoading,  setPanelLoading]  = useState(false);
  const [saving,        setSaving]        = useState(false);

  // Change password
  const [showChangePw,   setShowChangePw]   = useState(false);
  const [currentPw,      setCurrentPw]      = useState("");
  const [newPw,          setNewPw]          = useState("");
  const [confirmPw,      setConfirmPw]      = useState("");
  const [changingPw,     setChangingPw]     = useState(false);
  const [changePwError,  setChangePwError]  = useState<string | null>(null);

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
    const res = await fetch("/api/coach/auth", {
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
    fetch("/api/coach/auth", { method: "DELETE" }).finally(() => setAuthed(false));
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
    // loadData and loadPlayers only call state setters and fetch -- they don't
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
      const res = await fetch("/api/coach/roster-announcement", {
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
      const res = await fetch("/api/coach/roster-announcement", {
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
      const res = await fetch("/api/coach/roster-announcement", {
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
      const res = await fetch("/api/coach/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (res.ok) {
        // Session was cleared server-side -- force re-login with the new password.
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

  const panelGame = schedule.find(g => g.id === panelGameId);

  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <title>Coach Portal -- Armani Katehano</title>
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
                {/* Game row */}
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

                {/* Inline roster panel */}
                {panelGameId === g.id && (
                  <div className="mt-1 rounded-[10px] border border-[#4caf7d40] p-5 bg-ak-base">
                    {panelLoading ? (
                      <div className="flex justify-center py-8"><Spinner /></div>
                    ) : (
                      <>
                        {/* Player selection */}
                        <div className="mb-5">
                          <div className="text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[10px]">
                            Players &nbsp;
                            <span className={selectedCount > 0 ? "text-ak-green font-bold" : "text-ak-text-dim font-bold"}>
                              ({selectedCount} selected)
                            </span>
                          </div>

                          {allPlayers.length === 0 ? (
                            <div className="text-xs text-ak-text-dim">No active players found.</div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {allPlayers.map(p => {
                                const slot = rosterSlots[p.id] ?? { checked: false, note: "" };
                                return (
                                  <div key={p.id} className={[
                                    "flex items-center gap-[10px] py-[7px] px-3 rounded-lg border transition-[background,border-color] duration-100",
                                    slot.checked ? "bg-[#4caf7d12] border-[#4caf7d40]" : "bg-ak-surface2 border-ak-border",
                                  ].join(" ")}>
                                    <input
                                      type="checkbox"
                                      checked={slot.checked}
                                      onChange={() => togglePlayer(p.id)}
                                      className="w-4 h-4 shrink-0 cursor-pointer accent-ak-green"
                                    />
                                    <span className={["text-xs font-black min-w-[30px] tabular-nums", slot.checked ? "text-ak-green" : "text-ak-text-dim"].join(" ")}>#{p.number}</span>
                                    <span className={["text-[13px] flex-1", slot.checked ? "text-ak-text font-bold" : "text-ak-text-sub font-normal"].join(" ")}>{p.name}</span>
                                    <span className="text-[10px] text-ak-text-dim min-w-[36px]">{p.position}</span>
                                    {slot.checked && (
                                      <input
                                        type="text"
                                        value={slot.note}
                                        onChange={e => setNote(p.id, e.target.value)}
                                        placeholder="note (e.g. starting)"
                                        maxLength={200}
                                        className="w-[170px] py-[3px] px-2 text-[11px] rounded-[5px] border border-ak-border2 bg-ak-surface text-ak-text font-sans outline-none"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Coach message */}
                        <div className="mb-5">
                          <label className="block">
                            <span className="block text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[6px]">
                              Coach message <span className="font-normal normal-case tracking-normal">(optional)</span>
                            </span>
                            <textarea
                              value={rosterMsg}
                              onChange={e => setRosterMsg(e.target.value)}
                              placeholder="Add a message for fans..."
                              maxLength={1000}
                              rows={3}
                              className="w-full py-2 px-3 text-[13px] rounded-lg border border-ak-border2 bg-ak-surface text-ak-text font-sans outline-none resize-y"
                            />
                            <span className="text-[10px] text-ak-text-dim">{rosterMsg.length} / 1000</span>
                          </label>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-[10px] flex-wrap items-center">
                          <Btn onClick={publish} disabled={saving} variant="green">
                            {saving ? "SAVING..." : announcedGameIds.has(g.id) ? "UPDATE ROSTER" : "PUBLISH ROSTER"}
                          </Btn>
                          {announcedGameIds.has(g.id) && (
                            <Btn onClick={resendEmail} disabled={saving} variant="ghost">
                              RESEND EMAIL
                            </Btn>
                          )}
                          {announcedGameIds.has(g.id) && (
                            <Btn onClick={removeAnnouncement} disabled={saving} variant="danger">
                              REMOVE
                            </Btn>
                          )}
                          <Btn variant="ghost" onClick={closePanel}>CANCEL</Btn>
                        </div>
                      </>
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
            <div className="max-w-[360px]">
              <div className="text-[13px] font-black text-ak-text mb-[14px]">Change password</div>
              <form onSubmit={changePassword} className="flex flex-col gap-[10px]">
                {[
                  { label: "Current password", value: currentPw,  setter: setCurrentPw },
                  { label: "New password",      value: newPw,      setter: setNewPw },
                  { label: "Confirm password",  value: confirmPw,  setter: setConfirmPw },
                ].map(({ label, value, setter }) => (
                  <div key={label}>
                    <label className="block text-[10px] font-black tracking-[0.12em] text-ak-text-dim uppercase mb-1">{label}</label>
                    <input
                      type="password"
                      value={value}
                      onChange={e => setter(e.target.value)}
                      required
                      className="w-full py-2 px-3 text-[13px] rounded-lg border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none"
                    />
                  </div>
                ))}
                {changePwError && <div className="text-xs text-ak-red-text">{changePwError}</div>}
                <div className="flex gap-2 mt-1">
                  <Btn variant="green" disabled={changingPw}>
                    {changingPw ? "SAVING..." : "UPDATE PASSWORD"}
                  </Btn>
                  <Btn variant="ghost" onClick={() => { setShowChangePw(false); setChangePwError(null); }}>CANCEL</Btn>
                </div>
              </form>
            </div>
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
  const { isValidCoachToken } = await import("../../lib/coachAuth");
  if (!isValidCoachToken(params.token ?? "")) {
    return { notFound: true };
  }
  return { props: {} };
}
