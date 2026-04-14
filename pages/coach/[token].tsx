/**
 * pages/coach/[token].tsx
 *
 * Coach portal — roster announcement management.
 * The [token] segment must match the COACH_TOKEN env var (validated server-side).
 * A wrong token returns 404, revealing nothing about the page's existence.
 *
 * Auth: separate COACH_PASSWORD + __Host-ak_coach session cookie.
 */

import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { C } from "../../lib/theme";
import { fmtDate } from "../../lib/utils";

// ─── Tiny shared primitives (no adminShared import — keeps coach bundle isolated) ─

function Spinner() {
  return (
    <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${C.border2}`, borderTopColor: C.redBright, animation: "spin 0.7s linear infinite" }} />
  );
}

function Btn({ onClick, disabled = false, children, variant = "primary", size = "md" }: any) {
  const bg     = variant === "danger" ? C.red : variant === "ghost" ? "transparent" : variant === "green" ? C.green : C.red;
  const color  = variant === "ghost" ? C.textDim : C.text;
  const border = variant === "ghost" ? `1px solid ${C.border2}` : "none";
  const pad    = size === "sm" ? "5px 10px" : "8px 18px";
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: pad, background: bg, color, border, borderRadius: 7, fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit" }}>
      {children}
    </button>
  );
}

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm({ onLogin, error }: { onLogin: (pw: string) => Promise<void>; error: string | null }) {
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(password);
    setLoading(false);
  };

  return (
    <div style={{ width: "100%", maxWidth: 360, borderRadius: 20, padding: 32, border: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22, background: `${C.red}18`, border: `1px solid ${C.red}45` }}>🏀</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>Coach Portal</div>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Armani Katehano</div>
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", marginBottom: 5, color: C.textDim, textTransform: "uppercase" }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter coach password" autoFocus
            style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>
        {error && <div style={{ fontSize: 12, color: C.redText }}>{error}</div>}
        <button type="submit" disabled={loading || !password}
          style={{ padding: 12, fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 10, border: "none", background: C.red, color: C.text, cursor: "pointer", fontFamily: "inherit", opacity: loading || !password ? 0.5 : 1 }}>
          {loading ? "VERIFYING…" : "SIGN IN"}
        </button>
      </form>
      <div style={{ textAlign: "center", fontSize: 10, color: C.textDim, marginTop: 16 }}>5 failed attempts → 15-minute lockout</div>
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

  const handleLogin = useCallback(async (password: string) => {
    setLoginError(null);
    const res = await fetch("/api/coach/auth", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
    } else {
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setLoginError(`Too many attempts. Try again in ${Math.ceil((body.retryAfter || 900) / 60)} min.`);
      } else {
        setLoginError(body.error ?? "Invalid credentials.");
      }
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
    setRosterSlots(prev => ({ ...prev, [pid]: { ...prev[pid], checked: !prev[pid].checked } }));
  };

  const setNote = (pid: string, note: string) => {
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
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner />
      </div>
    </>
  );

  if (!authed) return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <LoginForm onLogin={handleLogin} error={loginError} />
      </div>
    </>
  );

  // ── Authenticated UI ──────────────────────────────────────────────────────

  const panelGame = schedule.find(g => g.id === panelGameId);

  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <title>Coach Portal — Armani Katehano</title>
      </Head>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: ${C.base}; color: ${C.text}; }
      `}</style>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: C.red, letterSpacing: "0.1em", textTransform: "uppercase" }}>AK</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase" }}>Coach Portal</span>
          </div>
          <button onClick={handleLogout} style={{ padding: "5px 12px", fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", background: "transparent", border: `1px solid ${C.border2}`, borderRadius: 6, color: C.textDim, cursor: "pointer" }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 16px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>Upcoming games</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Select a game to announce or update the roster.</div>
        </div>

        {loadingData ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner /></div>
        ) : schedule.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.textDim }}>No upcoming games scheduled.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {schedule.map(g => (
              <div key={g.id}>
                {/* Game row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "12px 16px", borderRadius: 10, border: `1px solid ${panelGameId === g.id ? `${C.green}60` : C.border}`, background: panelGameId === g.id ? `${C.green}08` : C.surface2, transition: "border-color 0.15s, background 0.15s" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 900, fontSize: 14, color: C.text, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {g.location === "home" ? "vs" : "@"} {g.opponent}
                      {announcedGameIds.has(g.id) && (
                        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}40` }}>
                          Roster set
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>
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
                  <div style={{ marginTop: 4, borderRadius: 10, border: `1px solid ${C.green}40`, padding: 20, background: C.base }}>
                    {panelLoading ? (
                      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><Spinner /></div>
                    ) : (
                      <>
                        {/* Player selection */}
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, textTransform: "uppercase", marginBottom: 10 }}>
                            Players &nbsp;
                            <span style={{ color: selectedCount > 0 ? C.green : C.textDim, fontWeight: 700 }}>
                              ({selectedCount} selected)
                            </span>
                          </div>

                          {allPlayers.length === 0 ? (
                            <div style={{ fontSize: 12, color: C.textDim }}>No active players found.</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {allPlayers.map(p => {
                                const slot = rosterSlots[p.id] ?? { checked: false, note: "" };
                                return (
                                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderRadius: 8, background: slot.checked ? `${C.green}12` : C.surface2, border: `1px solid ${slot.checked ? `${C.green}40` : C.border}`, transition: "background 0.1s, border-color 0.1s" }}>
                                    <input
                                      type="checkbox"
                                      checked={slot.checked}
                                      onChange={() => togglePlayer(p.id)}
                                      style={{ accentColor: C.green, width: 16, height: 16, flexShrink: 0, cursor: "pointer" }}
                                    />
                                    <span style={{ fontSize: 12, fontWeight: 900, color: slot.checked ? C.green : C.textDim, minWidth: 30, fontVariantNumeric: "tabular-nums" }}>#{p.number}</span>
                                    <span style={{ fontSize: 13, color: slot.checked ? C.text : C.textSub, flex: 1, fontWeight: slot.checked ? 700 : 400 }}>{p.name}</span>
                                    <span style={{ fontSize: 10, color: C.textDim, minWidth: 36 }}>{p.position}</span>
                                    {slot.checked && (
                                      <input
                                        type="text"
                                        value={slot.note}
                                        onChange={e => setNote(p.id, e.target.value)}
                                        placeholder="note (e.g. starting)"
                                        maxLength={200}
                                        style={{ width: 170, padding: "3px 8px", fontSize: 11, borderRadius: 5, border: `1px solid ${C.border2}`, background: C.surface, color: C.text, fontFamily: "inherit", outline: "none" }}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Coach message */}
                        <div style={{ marginBottom: 20 }}>
                          <label style={{ display: "block" }}>
                            <span style={{ display: "block", fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, textTransform: "uppercase", marginBottom: 6 }}>
                              Coach message <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                            </span>
                            <textarea
                              value={rosterMsg}
                              onChange={e => setRosterMsg(e.target.value)}
                              placeholder="Add a message for fans…"
                              maxLength={1000}
                              rows={3}
                              style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 8, border: `1px solid ${C.border2}`, background: C.surface, color: C.text, fontFamily: "inherit", outline: "none", resize: "vertical" }}
                            />
                            <span style={{ fontSize: 10, color: C.textDim }}>{rosterMsg.length} / 1000</span>
                          </label>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <Btn onClick={publish} disabled={saving} variant="green">
                            {saving ? "SAVING…" : announcedGameIds.has(g.id) ? "UPDATE ROSTER" : "PUBLISH ROSTER"}
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
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 16px 40px" }}>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
          {!showChangePw ? (
            <button
              onClick={() => setShowChangePw(true)}
              style={{ background: "none", border: "none", fontSize: 11, color: C.textDim, cursor: "pointer", padding: 0, fontFamily: "inherit", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              Change password
            </button>
          ) : (
            <div style={{ maxWidth: 360 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: C.text, marginBottom: 14 }}>Change password</div>
              <form onSubmit={changePassword} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Current password", value: currentPw,  setter: setCurrentPw },
                  { label: "New password",      value: newPw,      setter: setNewPw },
                  { label: "Confirm password",  value: confirmPw,  setter: setConfirmPw },
                ].map(({ label, value, setter }) => (
                  <div key={label}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", color: C.textDim, textTransform: "uppercase", marginBottom: 4 }}>{label}</label>
                    <input
                      type="password"
                      value={value}
                      onChange={e => setter(e.target.value)}
                      required
                      style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                ))}
                {changePwError && <div style={{ fontSize: 12, color: C.redText }}>{changePwError}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <Btn variant="green" disabled={changingPw}>
                    {changingPw ? "SAVING…" : "UPDATE PASSWORD"}
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
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 50, padding: "12px 18px", borderRadius: 10, background: toast.type === "error" ? `${C.red}22` : `${C.green}22`, color: toast.type === "error" ? C.redText : C.green, border: `1px solid ${toast.type === "error" ? `${C.red}55` : `${C.green}55`}`, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", gap: 12, fontSize: 13, fontWeight: 700 }}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "inherit", fontWeight: 900, lineHeight: 1 }}>×</button>
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
