/**
 * lib/adminShared.js
 * Shared utilities, hooks, and UI primitives for admin pages.
 *
 * Exports (complete list):
 *   Hooks:      useAdminAuth
 *   Layout:     AdminLayout
 *   Components: Spinner, LoginForm, BoxScoreTable, Btn, F, Sel, Toast, Confirm
 *   Helpers:    byJersey, fmt
 */

import { useState, useEffect, useCallback } from 'react';
import { C } from './theme.js';
import { fmt as _fmt } from './utils.js';

// ─── Re-export fmt ────────────────────────────────────────────────────────────
export { _fmt as fmt };

// ─── byJersey ─────────────────────────────────────────────────────────────────
/** Sort comparator -- orders players by jersey number ascending. */
export const byJersey = (a, b) => Number(a.number) - Number(b.number);

// ─── useAdminAuth ─────────────────────────────────────────────────────────────
/**
 * Single source of truth for admin authentication state.
 * Q-01: replaces ~25 lines of duplicated auth wiring in each admin page.
 */
export function useAdminAuth(slug) {
  const [authed,     setAuthed]  = useState(false);
  const [loading,    setLoading] = useState(true);
  const [loginError, setError]   = useState(null);

  useEffect(() => {
    fetch('/api/auth')
      .then(r => { if (r.ok) setAuthed(true); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = useCallback(async (password) => {
    setError(null);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, slug }),
    });
    if (res.ok) {
      setAuthed(true);
    } else {
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setError(`Too many attempts. Try again in ${Math.ceil((body.retryAfter || 900) / 60)} min.`);
      } else {
        setError(body.error ?? 'Invalid credentials.');
      }
    }
  }, [slug]);

  const handleLogout = useCallback(() => {
    fetch('/api/auth', { method: 'DELETE' }).finally(() => setAuthed(false));
  }, []);

  return { authed, loading, loginError, handleLogin, handleLogout };
}

// ─── AdminLayout ──────────────────────────────────────────────────────────────
/**
 * Shared chrome for all admin pages: top nav bar with page title and tab links,
 * toast notification overlay, and the page content area.
 */
export function AdminLayout({ slug, title, children, toast, setToast }) {
  const tabs = [
    { href: `/admin/${slug}`,         label: 'Dashboard' },
    { href: `/admin/${slug}/game-stats`,   label: 'Games'     },
    { href: `/admin/${slug}/roster`,  label: 'Roster'    },
    { href: `/admin/${slug}/seasons`, label: 'Seasons'   },
    { href: `/admin/${slug}/import`,  label: 'Import'    },
  ];

  const current = typeof window !== 'undefined' ? window.location.pathname : '';

  return (
    <div style={{ minHeight: '100vh', background: C.base, fontFamily: 'inherit' }}>
      {/* Top bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: C.red, letterSpacing: '0.1em', textTransform: 'uppercase', paddingRight: 24, borderRight: `1px solid ${C.border}`, marginRight: 16, whiteSpace: 'nowrap', padding: '14px 24px 14px 0' }}>
            AK Admin
          </div>
          {tabs.map(t => {
            const active = current === t.href || (t.href !== `/admin/${slug}` && current.startsWith(t.href));
            return (
              <a key={t.href} href={t.href} style={{
                padding: '14px 14px',
                fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: active ? C.redText : C.textDim,
                borderBottom: active ? `2px solid ${C.redBright}` : '2px solid transparent',
                textDecoration: 'none', whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}>
                {t.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px' }}>
        {children}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 50,
          padding: '12px 18px', borderRadius: 10,
          background: toast.type === 'error' ? `${C.red}22` : `${C.green}22`,
          color: toast.type === 'error' ? C.redText : C.green,
          border: `1px solid ${toast.type === 'error' ? `${C.red}55` : `${C.green}55`}`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 700,
        }}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'inherit', fontWeight: 900, lineHeight: 1 }}>×</button>
        </div>
      )}
    </div>
  );
}

// ─── BoxScoreTable ────────────────────────────────────────────────────────────
const BOX_COLS = [
  { key: 'min', label: 'MIN' }, { key: 'pts', label: 'PTS' }, { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' }, { key: 'stl', label: 'STL' }, { key: 'blk', label: 'BLK' },
  { key: 'tov', label: 'TOV' }, { key: 'fgm', label: 'FGM' }, { key: 'fga', label: 'FGA' },
  { key: 'fg2m', label: '2PM' }, { key: 'fg2a', label: '2PA' },
  { key: 'fg3m', label: '3PM' }, { key: 'fg3a', label: '3PA' },
  { key: 'ftm', label: 'FTM' }, { key: 'fta', label: 'FTA' }, { key: 'eff', label: 'EFF' },
];

/**
 * Editable box score grid used in the games admin and import pages.
 *
 * Props:
 *   players    -- PlayerBio[]
 *   rows       -- BoxScoreRow[]  (keyed by pid)
 *   onUpdate   -- (pid, field, value) => void
 *   highlights -- { [pid]: true }  players who played (shown in green)
 */
export function BoxScoreTable({ players, rows, onUpdate, highlights = {} }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 900 }}>
        <thead>
          <tr style={{ background: C.base }}>
            <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 9, fontWeight: 900, color: C.textDim, letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>#</th>
            <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 9, fontWeight: 900, color: C.textDim, letterSpacing: '0.12em', minWidth: 130 }}>PLAYER</th>
            {BOX_COLS.map(c => (
              <th key={c.key} style={{ padding: '7px 6px', fontSize: 9, fontWeight: 900, color: c.key === 'eff' ? C.redText : C.textDim, letterSpacing: '0.1em', textAlign: 'center', minWidth: 40 }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const player  = players.find(p => p.id === (row.pid || row.playerId));
            const played  = highlights[row.pid || row.playerId];
            const rowBg   = played ? `${C.green}10` : (i % 2 === 0 ? C.surface : C.surface2);
            return (
              <tr key={row.pid || row.playerId} style={{ background: rowBg, borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: '5px 10px', color: C.textDim, fontWeight: 700 }}>{player?.number ?? '?'}</td>
                <td style={{ padding: '5px 10px', color: played ? C.green : C.text, fontWeight: played ? 900 : 400, fontSize: 12 }}>
                  {player ? _fmt(player.name) : '--'}
                </td>
                {BOX_COLS.map(c => (
                  <td key={c.key} style={{ padding: '3px 4px', textAlign: 'center' }}>
                    {onUpdate ? (
                      <input
                        type="number"
                        value={row[c.key] ?? 0}
                        onChange={e => onUpdate(row.pid || row.playerId, c.key, e.target.value)}
                        style={{
                          width: 38, textAlign: 'center', fontSize: 11, padding: '2px 0',
                          background: 'transparent', border: `1px solid ${played ? `${C.green}40` : C.border}`,
                          borderRadius: 4, color: c.key === 'eff' ? C.redText : C.textSub,
                          fontFamily: 'inherit',
                        }}
                      />
                    ) : (
                      <span style={{ color: c.key === 'eff' ? C.redText : C.textSub }}>{row[c.key] ?? 0}</span>
                    )}
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

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${C.border2}`, borderTopColor: C.redBright, animation: 'spin 0.7s linear infinite' }} />
  );
}

// ─── LoginForm ────────────────────────────────────────────────────────────────
export function LoginForm({ onLogin, error }) {
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(password);
    setLoading(false);
  };

  return (
    <div style={{ width: '100%', maxWidth: 360, borderRadius: 20, padding: 32, border: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 22, background: `${C.red}18`, border: `1px solid ${C.red}45` }}>🔐</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>Admin Access</div>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Armani Katehano · Team Manager</div>
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', marginBottom: 5, color: C.textDim, textTransform: 'uppercase' }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
            style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, fontFamily: 'inherit', outline: 'none' }} />
        </div>
        {error && <div style={{ fontSize: 12, color: C.redText }}>{error}</div>}
        <button type="submit" disabled={loading || !password}
          style={{ padding: '12px', fontWeight: 900, fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', borderRadius: 10, border: 'none', background: C.red, color: C.text, cursor: 'pointer', fontFamily: 'inherit', opacity: loading || !password ? 0.5 : 1 }}>
          {loading ? 'VERIFYING...' : 'SIGN IN'}
        </button>
      </form>
      <div style={{ textAlign: 'center', fontSize: 10, color: C.textDim, marginTop: 16 }}>5 failed attempts -> 15-minute lockout</div>
    </div>
  );
}

// ─── Btn ──────────────────────────────────────────────────────────────────────
export function Btn({ onClick, disabled, children, variant = 'primary', size }) {
  const bg = variant === 'danger'    ? C.red
           : variant === 'ghost'     ? 'transparent'
           : variant === 'green'     ? C.green
           : variant === 'secondary' ? C.surface2
           : C.red;
  const color = variant === 'ghost' ? C.textDim : C.text;
  const border = variant === 'ghost' ? `1px solid ${C.border2}` : 'none';
  const pad = size === 'sm' ? '5px 10px' : '8px 16px';
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: pad, background: bg, color, border, borderRadius: 7,
      fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      fontFamily: 'inherit',
    }}>
      {children}
    </button>
  );
}

// ─── F (field input) ──────────────────────────────────────────────────────────
export function F({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', color: C.textDim, textTransform: 'uppercase', marginBottom: 4 }}>{label}</span>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 7, border: `1px solid ${C.border2}`, background: C.base, color: C.text, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
    </label>
  );
}

// ─── Sel (select) ─────────────────────────────────────────────────────────────
export function Sel({ label, value, onChange, options = [] }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', color: C.textDim, textTransform: 'uppercase', marginBottom: 4 }}>{label}</span>
      <select value={value ?? ''} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 7, border: `1px solid ${C.border2}`, background: C.base, color: C.text, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 50,
      padding: '12px 18px', borderRadius: 10,
      background: type === 'error' ? `${C.red}22` : `${C.green}22`,
      color: type === 'error' ? C.redText : C.green,
      border: `1px solid ${type === 'error' ? `${C.red}55` : `${C.green}55`}`,
      display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 700,
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'inherit', fontWeight: 900 }}>×</button>
    </div>
  );
}

// ─── Confirm ──────────────────────────────────────────────────────────────────
export function Confirm({ msg, onConfirm, onCancel }) {
  if (!msg) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: C.surface, padding: '2rem', borderRadius: 12, maxWidth: 400, width: '90%', border: `1px solid ${C.border2}` }}>
        <p style={{ marginBottom: '1.5rem', color: C.text, fontSize: 14 }}>{msg}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm}>Confirm</Btn>
        </div>
      </div>
    </div>
  );
}