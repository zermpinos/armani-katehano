/**
 * lib/adminShared.js
 *
 * Shared constants, UI primitives, auth helper, and layout component
 * used by all admin sub-pages. Import what you need from here instead
 * of duplicating across pages.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { C } from "./theme.js";

export const F = ({ label, value, onChange, type = "text", placeholder = "", sm = false }) => (
  <div>
    {label && <label style={{ display: "block", fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", marginBottom: 5, color: C.textDim, textTransform: "uppercase" }}>{label}</label>}
    <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", padding: sm ? "5px 8px" : "9px 12px", fontSize: sm ? 11 : 13, borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, fontFamily: "inherit", outline: "none" }} />
  </div>
);

export const Sel = ({ label, value, onChange, options }) => (
  <div>
    {label && <label style={{ display: "block", fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", marginBottom: 5, color: C.textDim, textTransform: "uppercase" }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, fontFamily: "inherit", outline: "none" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

export const Btn = ({ children, onClick, variant = "primary", size = "md", disabled = false, type = "button" }) => {
  const bg  = variant === "primary" ? C.red : variant === "danger" ? "#7f1d1d" : variant === "green" ? C.greenDim : "transparent";
  const bc  = variant === "ghost" ? C.border2 : "transparent";
  const col = variant === "ghost" ? C.textSub : C.text;
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding: size === "sm" ? "5px 12px" : "9px 18px", fontSize: size === "sm" ? 11 : 13,
      fontWeight: 900, letterSpacing: "0.1em", borderRadius: 8, border: `1px solid ${bc}`,
      background: bg, color: col, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1, fontFamily: "inherit",
    }}>{children}</button>
  );
};

export const Toast = ({ msg, type, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 300, display: "flex", alignItems: "center", gap: 10, borderRadius: 12, padding: "12px 20px", background: C.surface2, color: C.text, fontSize: 14, fontWeight: 600, border: `1px solid ${type === "success" ? `${C.green}60` : `${C.redText}60`}`, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      {type === "success" ? "✓" : "✕"} {msg}
    </div>
  );
};

export const Confirm = ({ msg, onConfirm, onCancel }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)" }}>
    <div style={{ background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 16, padding: 24, maxWidth: 360, width: "90%" }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: C.text, marginBottom: 8 }}>Are you sure?</div>
      <div style={{ fontSize: 13, color: C.textSub, marginBottom: 24 }}>{msg}</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm}>Delete</Btn>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
export const fmt = name => {
  if (!name) return "";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 1] + " " + parts[0][0].toUpperCase() + ".";
};

export const byJersey = (a, b) => Number(a.number) - Number(b.number);

// ─────────────────────────────────────────────────────────────────────────────
// Box score column definitions (shared between import and games pages)
// ─────────────────────────────────────────────────────────────────────────────
export const BOX_COLS = [
  { key: "pts",  label: "PTS", sub: "ΠΟ" },
  { key: "ftm",  label: "FTM", sub: "ΒΟΛ" }, { key: "fta",  label: "FTA", sub: "" },
  { key: "fg2m", label: "2PM", sub: "ΔΙΠ" }, { key: "fg2a", label: "2PA", sub: "" },
  { key: "fg3m", label: "3PM", sub: "ΤΡΙΠ" }, { key: "fg3a", label: "3PA", sub: "" },
  { key: "fgm",  label: "FGM", sub: "" },     { key: "fga",  label: "FGA", sub: "" },
  { key: "pf",   label: "PF",  sub: "ΦΑ" },
  { key: "drb",  label: "DRB", sub: "Ρ.Α." }, { key: "orb",  label: "ORB", sub: "Ρ.Ε." },
  { key: "reb",  label: "REB", sub: "ΡΙΜ" },
  { key: "ast",  label: "AST", sub: "ΠΑΣ" },
  { key: "stl",  label: "STL", sub: "ΚΛ." },
  { key: "blk",  label: "BLK", sub: "ΚΟ." },
  { key: "tov",  label: "TOV", sub: "ΛΑ." },
  { key: "eff",  label: "EFF", sub: "RAN" },
  { key: "min",  label: "MIN", sub: "ΧΡ." },
];

// ─────────────────────────────────────────────────────────────────────────────
// BoxScoreTable (shared between import review and game edit)
// ─────────────────────────────────────────────────────────────────────────────
export function BoxScoreTable({ players, rows, onUpdate, readOnly = false, highlights = {} }) {
  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.border}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 1100 }}>
        <thead>
          <tr style={{ background: C.surface2, borderBottom: `1px solid ${C.border2}` }}>
            <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 900, color: C.textDim, minWidth: 36, letterSpacing: "0.12em" }}>#</th>
            <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 900, color: C.textDim, minWidth: 150, letterSpacing: "0.12em" }}>PLAYER</th>
            {BOX_COLS.map(c => (
              <th key={c.key} style={{ padding: "7px 6px", fontSize: 9, fontWeight: 900, color: C.textDim, minWidth: 44, textAlign: "center", letterSpacing: "0.1em" }}>
                <div>{c.label}</div>
                {c.sub && <div style={{ fontSize: 8, color: C.textDim, opacity: 0.6, fontWeight: 700 }}>{c.sub}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const pl = players.find(p => p.id === row.pid || p.id === row.playerId);
            if (!pl) return null;
            const hl = highlights[row.pid || row.playerId];
            return (
              <tr key={row.pid || row.playerId} style={{ background: hl ? `${C.green}12` : C.surface, borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "5px 10px", fontWeight: 700, color: hl ? C.green : C.textDim }}>
                  <span style={{ padding: "2px 5px", borderRadius: 4, background: hl ? `${C.green}22` : C.border, fontSize: 10 }}>{pl.number}</span>
                </td>
                <td style={{ padding: "5px 10px" }}>
                  <div style={{ fontWeight: 700, color: hl ? C.text : C.textSub, fontSize: 12 }}>{pl.name}</div>
                </td>
                {BOX_COLS.map(c => (
                  <td key={c.key} style={{ padding: "3px 3px", textAlign: "center" }}>
                    {readOnly
                      ? <span style={{ fontWeight: c.key === "pts" || c.key === "eff" ? 900 : 400, color: c.key === "pts" && row.pts >= 15 ? C.redText : C.textSub }}>{row[c.key] ?? 0}</span>
                      : <input type="number" value={row[c.key] ?? 0} onChange={e => onUpdate(row.pid || row.playerId, c.key, e.target.value)}
                          style={{ width: 40, textAlign: "center", fontSize: 11, padding: "4px 2px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontFamily: "inherit", outline: "none" }} />
                    }
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminLayout — shared header + nav used by all sub-pages
// ─────────────────────────────────────────────────────────────────────────────
export function AdminLayout({ slug, children, title = "Admin", toast, setToast }) {
  const router = useRouter();
  const currentPath = router.pathname;

  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push(`/admin/${slug}`);
  };

  const navItems = [
    { href: `/admin/${slug}`,          label: "Dashboard", icon: "◈" },
    { href: `/admin/${slug}/import`,   label: "Import",    icon: "↓" },
    { href: `/admin/${slug}/games`,    label: "Games",     icon: "◉" },
    { href: `/admin/${slug}/roster`,   label: "Roster",    icon: "◎" },
    { href: `/admin/${slug}/seasons`,  label: "Seasons",   icon: "◇" },
  ];

  const isActive = href => currentPath === href.replace(`/admin/${slug}`, `/admin/[slug]`);

  return (
    <div style={{ minHeight: "100vh", background: C.base, color: C.text, fontFamily: "'Trebuchet MS','Gill Sans',sans-serif" }}>
      <Head>
        <meta name="robots" content="noindex,nofollow,noarchive" />
        <title>{title} · Armani Katehano</title>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} input,select{outline:none}`}</style>
      </Head>

      {/* Top bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ height: 3, background: `linear-gradient(90deg,${C.red},${C.redBright},${C.red})` }} />
        <div style={{ padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", height: 52 }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, background: C.red, color: C.text }}>AK</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text }}>Armani Katehano</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: C.redText }}>ADMIN</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", gap: 4 }}>
            {navItems.map(item => (
              <a key={item.href} href={item.href}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textDecoration: "none", textTransform: "uppercase",
                  background: isActive(item.href) ? `${C.red}22` : "transparent",
                  color: isActive(item.href) ? C.redText : C.textDim,
                  border: `1px solid ${isActive(item.href) ? `${C.red}50` : "transparent"}`,
                }}>
                <span style={{ fontSize: 12 }}>{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>

          <button onClick={logout} style={{ fontSize: 10, fontWeight: 900, padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.border2}`, background: "transparent", color: C.textDim, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.12em" }}>
            LOGOUT
          </button>
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        {children}
      </div>

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useAdminAuth — client-side auth guard hook used by every sub-page
// ─────────────────────────────────────────────────────────────────────────────
export function useAdminAuth(validSlug) {
  const [authed, setAuthed]     = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!validSlug) { setChecking(false); return; }
    fetch("/api/auth", { method: "GET" })
      .then(r => { setAuthed(r.ok); setChecking(false); })
      .catch(() => setChecking(false));
  }, [validSlug]);

  return { authed, checking };
}

