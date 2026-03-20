/**
 * pages/admin/[slug]/index.js
 * Dashboard — loads only aggregate stats. Fast.
 */

import { useState, useEffect } from "react";
import { C } from "../../../lib/theme";
import { AdminLayout, useAdminAuth, Btn, Toast } from "../../../lib/adminShared";

export default function AdminDashboard({ validSlug }) {
  const { authed, checking } = useAdminAuth(validSlug);
  const [data,    setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]  = useState(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const slug = typeof window !== "undefined" ? window.location.pathname.split("/")[2] : "";

  const showToast = (msg, type = "success") => setToast({ msg, type });

  useEffect(() => {
    if (authed) loadDashboard();
  }, [authed]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // Only fetch the lightweight dashboard summary — not full game list
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) return;
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setAuthLoading(true); setAuthError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, slug }),
      });
      if (res.ok) { setPassword(""); loadDashboard(); }
      else {
        const d = await res.json();
        if (res.status === 429) setAuthError(`Too many attempts. Try again in ${Math.ceil((d.retryAfter || 900) / 60)} min.`);
        else setAuthError("Invalid credentials.");
      }
    } catch { setAuthError("Network error."); }
    finally { setAuthLoading(false); }
  };

  // ── Not a valid slug ──────────────────────────────────────────────────────
  if (!validSlug) return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 96, fontWeight: 900, color: C.border }}>404</div>
        <div style={{ fontSize: 14, color: C.textDim }}>Page not found</div>
      </div>
    </div>
  );

  // ── Auth check in progress ────────────────────────────────────────────────
  if (checking) return <Spinner />;

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 360, borderRadius: 20, padding: 32, border: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22, background: `${C.red}18`, border: `1px solid ${C.red}45` }}>🔐</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>Admin Access</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Armani Katehano · Team Manager</div>
        </div>
        <form onSubmit={login} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", marginBottom: 5, color: C.textDim, textTransform: "uppercase" }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
              style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, fontFamily: "inherit", outline: "none" }} />
          </div>
          {authError && <div style={{ fontSize: 12, color: C.redText }}>{authError}</div>}
          <button type="submit" disabled={authLoading || !password}
            style={{ padding: "12px", fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 10, border: "none", background: C.red, color: C.text, cursor: "pointer", fontFamily: "inherit", opacity: authLoading || !password ? 0.5 : 1 }}>
            {authLoading ? "VERIFYING…" : "SIGN IN"}
          </button>
        </form>
        <div style={{ textAlign: "center", fontSize: 10, color: C.textDim, marginTop: 16 }}>5 failed attempts → 15-minute lockout</div>
      </div>
    </div>
  );

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const wins   = data?.record?.wins   ?? 0;
  const losses = data?.record?.losses ?? 0;

  const quickLinks = [
    { href: `import`,  label: "Import game",   icon: "↓", desc: "Add a new game from sportstats.gr" },
    { href: `games`,   label: "Game results",  icon: "◉", desc: `${data?.totalGames ?? "—"} games recorded` },
    { href: `roster`,  label: "Roster",        icon: "◎", desc: `${data?.totalPlayers ?? "—"} players` },
    { href: `seasons`, label: "Seasons",       icon: "◇", desc: `${data?.totalSeasonLeagues ?? "—"} active leagues` },
  ];

  return (
    <AdminLayout slug={slug} title="Dashboard" toast={toast} setToast={setToast}>
      {loading ? <Spinner /> : (
        <>
          {/* Summary strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginBottom: 28 }}>
            {[
              ["SEASON",  data?.currentSeason ?? "—"],
              ["RECORD",  `${wins}–${losses}`],
              ["PPG",     data?.ppg ?? "—"],
              ["RPG",     data?.rpg ?? "—"],
              ["APG",     data?.apg ?? "—"],
            ].map(([label, value]) => (
              <div key={label} style={{ borderRadius: 10, padding: "12px 14px", textAlign: "center", border: `1px solid ${C.border}`, background: C.surface }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: label === "SEASON" ? 14 : 22, fontWeight: 900, color: label === "SEASON" ? C.redText : C.text }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
            {quickLinks.map(link => (
              <a key={link.href} href={link.href}
                style={{ display: "block", borderRadius: 12, padding: "18px 20px", border: `1px solid ${C.border}`, background: C.surface, textDecoration: "none", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.red}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{link.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: C.text, marginBottom: 3 }}>{link.label}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{link.desc}</div>
              </a>
            ))}
          </div>

          {/* Recent games — last 5 only */}
          {data?.recentGames?.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 10, textTransform: "uppercase" }}>Recent games</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.recentGames.map(g => (
                  <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 900, background: g.result === "W" ? `${C.green}22` : `${C.red}22`, color: g.result === "W" ? C.green : C.redText }}>{g.result}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>vs {g.opponent}</span>
                      <span style={{ fontSize: 12, color: C.textDim }}>{g.teamScore}–{g.opponentScore}</span>
                    </div>
                    <span style={{ fontSize: 11, color: C.textDim }}>{g.playedOn?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <a href="games" style={{ fontSize: 11, color: C.redText, fontWeight: 700, textDecoration: "none" }}>View all games →</a>
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${C.border2}`, borderTopColor: C.redBright, animation: "spin 0.7s linear infinite" }} />
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const { slug } = params;
  const expected = process.env.ADMIN_SLUG;
  let validSlug = false;
  try {
    const crypto = await import("crypto");
    const a = Buffer.from(slug || "");
    const b = Buffer.from(expected || "");
    if (a.length === b.length) validSlug = crypto.timingSafeEqual(a, b);
  } catch { validSlug = slug === expected; }
  return { props: { validSlug } };
}
