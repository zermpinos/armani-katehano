// lib/adminShared.js  -- FULL REWRITE
// Before: exported fmt(), Btn, F, Sel, Toast, Confirm -- but Spinner, LoginForm were NOT here
// After:  adds Spinner, LoginForm as named exports; adds useAdminAuth as the single auth pattern
//         all four admin pages will import from here instead of duplicating

import { useState, useEffect, useCallback } from 'react';
import { fmt } from './utils.js';  // canonical fmt -- removes Q-02 duplication too

// ─── Re-export fmt so admin pages don't need two imports ──────────────────────
export { fmt };

// ─── useAdminAuth ─────────────────────────────────────────────────────────────
/**
 * Single source of truth for admin authentication state.
 *
 * Replaces the copy-pasted fetch+useState+useEffect pattern in all four admin
 * pages. Previously each page had ~25 lines of identical auth wiring; this hook
 * reduces that to one line per page.
 *
 * Returns:
 *   authed       -- true once /api/auth confirms a valid session
 *   loading      -- true during the initial session check
 *   loginError   -- string | null set when POST /api/auth fails
 *   handleLogin  -- (password) => Promise<void>  called by LoginForm
 *   handleLogout -- () => void
 */
export function useAdminAuth(slug) {
  const [authed, setAuthed]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [loginError, setError]    = useState(null);

  // Check existing session on mount
  useEffect(() => {
    fetch('/api/auth')
      .then(r => { if (r.ok) setAuthed(true); })
      .catch(() => {})           // network errors -> just show login form
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
      setError(body.error ?? 'Login failed');
    }
  }, [slug]);

  const handleLogout = useCallback(() => {
    fetch('/api/auth', { method: 'DELETE' }).finally(() => {
      setAuthed(false);
    });
  }, []);

  return { authed, loading, loginError, handleLogin, handleLogout };
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
/**
 * Full-page loading spinner.
 * Was duplicated verbatim in games.js, roster.js, seasons.js, import.js.
 * Now lives here as the single canonical version.
 */
export function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <div style={{
        width: 40, height: 40,
        border: '4px solid #e5e7eb',
        borderTop: '4px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── LoginForm ────────────────────────────────────────────────────────────────
/**
 * Admin login form.
 * Was duplicated verbatim in games.js, roster.js, seasons.js, import.js.
 *
 * Props:
 *   onLogin   -- async (password: string) => void
 *   error     -- string | null   displayed below the submit button
 */
export function LoginForm({ onLogin, error }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    await onLogin(pw);
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 360, margin: '6rem auto', padding: '2rem',
                  border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 600 }}>
        Admin Login
      </h2>
      {/* NOTE: no <form> tag -- use div + onClick to avoid HTML form submit behavior
          which causes a full page reload in Next.js API routes */}
      <div>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !busy && submit(e)}
          placeholder="Password"
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem',
                   border: '1px solid #d1d5db', borderRadius: 6, fontSize: '1rem' }}
          autoFocus
        />
        <button
          onClick={submit}
          disabled={busy || !pw}
          style={{ width: '100%', padding: '0.6rem', background: '#3b82f6',
                   color: '#fff', border: 'none', borderRadius: 6,
                   fontSize: '1rem', cursor: busy ? 'wait' : 'pointer',
                   opacity: busy || !pw ? 0.6 : 1 }}
        >
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
        {error && (
          <p style={{ color: '#ef4444', marginTop: '0.75rem', fontSize: '0.875rem' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Existing small UI primitives (unchanged, kept for backwards compat) ──────
export function Btn({ onClick, disabled, children, variant = 'primary' }) {
  const bg = variant === 'danger' ? '#ef4444' : variant === 'secondary' ? '#6b7280' : '#3b82f6';
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: '0.4rem 1rem', background: bg, color: '#fff',
               border: 'none', borderRadius: 5, cursor: disabled ? 'not-allowed' : 'pointer',
               opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  );
}

export function F({ label, value, onChange, type = 'text' }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.75rem' }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ display: 'block', width: '100%', marginTop: 4,
                 padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
    </label>
  );
}

export function Sel({ label, value, onChange, options }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.75rem' }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ display: 'block', width: '100%', marginTop: 4,
                 padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;
  const bg = type === 'error' ? '#fef2f2' : '#f0fdf4';
  const color = type === 'error' ? '#b91c1c' : '#15803d';
  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 50,
                  padding: '0.75rem 1.25rem', background: bg, color, borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', gap: '0.75rem' }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none',
                                         cursor: 'pointer', color, fontWeight: 700 }}>×</button>
    </div>
  );
}

export function Confirm({ message, onConfirm, onCancel }) {
  if (!message) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', padding: '2rem', borderRadius: 8,
                    maxWidth: 400, width: '90%' }}>
        <p style={{ marginBottom: '1.5rem' }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm}>Confirm</Btn>
        </div>
      </div>
    </div>
  );
}