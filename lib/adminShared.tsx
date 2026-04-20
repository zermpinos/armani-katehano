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

import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { fmt as _fmt } from './utils';

// ─── Re-export fmt ────────────────────────────────────────────────────────────
export { _fmt as fmt };

// ─── byJersey ─────────────────────────────────────────────────────────────────
/** Sort comparator -- orders players by jersey number ascending. */
export const byJersey = (a: any, b: any) => Number(a.number) - Number(b.number);

// ─── useAdminAuth ─────────────────────────────────────────────────────────────
/**
 * Single source of truth for admin authentication state.
 * Q-01: replaces ~25 lines of duplicated auth wiring in each admin page.
 */
export function useAdminAuth(slug: any) {
  const [authed,     setAuthed]  = useState(false);
  const [loading,    setLoading] = useState(true);
  const [loginError, setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth')
      .then(r => { if (r.ok) setAuthed(true); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = useCallback(async (username: string, password: string, totpToken: string, captchaToken?: string | null) => {
    setError(null);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, totpToken, slug, captchaToken }),
    });
    if (res.ok) {
      setAuthed(true);
      return { failed: false };
    } else {
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setError(`Too many attempts. Try again in ${Math.ceil((body.retryAfter || 900) / 60)} min.`);
      } else {
        setError(body.error ?? 'Invalid credentials.');
      }
      return { failed: true, requiresCaptcha: body.requiresCaptcha ?? false };
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
export function AdminLayout({ slug, title, children, toast, setToast, onLogout }: { slug: any; title: any; children: any; toast: any; setToast: any; onLogout?: () => void }) {
  const tabs = [
    { href: `/admin/${slug}`,         label: 'Dashboard' },
    { href: `/admin/${slug}/games`,   label: 'Games'     },
    { href: `/admin/${slug}/roster`,  label: 'Roster'    },
    { href: `/admin/${slug}/seasons`, label: 'Seasons'   },
    { href: `/admin/${slug}/schedule`, label: 'Schedule' },
    { href: `/admin/${slug}/import`,  label: 'Import'    },
  ];

  const current = typeof window !== 'undefined' ? window.location.pathname : '';

  return (
    <div className="min-h-screen bg-ak-base">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/* Top bar */}
      <div className="bg-ak-surface border-b border-ak-border sticky top-0 z-40">
        <div className="max-w-[1100px] mx-auto px-4 flex items-center overflow-x-auto">
          <div className="text-[13px] font-black text-ak-red tracking-[0.1em] uppercase py-[14px] pr-6 border-r border-ak-border mr-4 whitespace-nowrap shrink-0">
            AK Admin
          </div>
          {tabs.map(t => {
            const active = current === t.href || (t.href !== `/admin/${slug}` && current.startsWith(t.href));
            return (
              <a key={t.href} href={t.href} className={[
                'px-[14px] py-[14px] text-[11px] font-black tracking-[0.12em] uppercase whitespace-nowrap transition-colors duration-150 border-b-2',
                active ? 'text-ak-red-text border-ak-red-bright' : 'text-ak-text-dim border-transparent',
              ].join(' ')}>
                {t.label}
              </a>
            );
          })}
          {onLogout && (
            <button onClick={onLogout} className="ml-auto px-3 py-[6px] text-[10px] font-black tracking-[0.1em] uppercase bg-transparent border border-ak-border2 rounded-md text-ak-text-dim cursor-pointer whitespace-nowrap shrink-0">
              Sign out
            </button>
          )}
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-[1100px] mx-auto py-8 px-4">
        {children}
      </div>

      {/* Toast */}
      {toast && (
        <div className={[
          'fixed bottom-6 right-6 z-50 px-[18px] py-3 rounded-[10px]',
          'flex items-center gap-3 text-[13px] font-bold shadow-[0_4px_16px_rgba(0,0,0,0.25)]',
          toast.type === 'error'
            ? 'bg-[#8b1a1a22] text-ak-red-text border border-[#8b1a1a55]'
            : 'bg-[#4caf7d22] text-ak-green border border-[#4caf7d55]',
        ].join(' ')}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="bg-transparent border-0 cursor-pointer text-[18px] text-current font-black leading-none p-0">×</button>
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
export function BoxScoreTable({ players, rows, onUpdate, highlights = {} }: { players: any; rows: any; onUpdate: any; highlights?: any }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-ak-border">
      <table className="w-full border-collapse text-[11px] min-w-[900px]">
        <thead>
          <tr className="bg-ak-base">
            <th className="py-[7px] px-[10px] text-left text-[9px] font-black text-ak-text-dim tracking-[0.12em] whitespace-nowrap">#</th>
            <th className="py-[7px] px-[10px] text-left text-[9px] font-black text-ak-text-dim tracking-[0.12em] min-w-[130px]">PLAYER</th>
            {BOX_COLS.map(c => (
              <th key={c.key} className={[
                'py-[7px] px-[6px] text-[9px] font-black tracking-[0.1em] text-center min-w-[40px]',
                c.key === 'eff' ? 'text-ak-red-text' : 'text-ak-text-dim',
              ].join(' ')}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, i: number) => {
            const player = players.find((p: any) => p.id === row.playerId);
            const played = highlights[row.playerId];
            return (
              <tr key={row.playerId} className={[
                'border-t border-ak-border',
                played ? 'bg-[#4caf7d10]' : i % 2 === 0 ? 'bg-ak-surface' : 'bg-ak-surface2',
              ].join(' ')}>
                <td className="py-[5px] px-[10px] text-ak-text-dim font-bold">{player?.number ?? '?'}</td>
                <td className={['py-[5px] px-[10px] text-[12px]', played ? 'text-ak-green font-black' : 'text-ak-text font-normal'].join(' ')}>
                  {player ? _fmt(player.name) : '--'}
                </td>
                {BOX_COLS.map(c => (
                  <td key={c.key} className="py-[3px] px-1 text-center">
                    {onUpdate ? (
                      <input
                        type="number"
                        value={row[c.key] ?? 0}
                        onChange={e => onUpdate(row.playerId, c.key, e.target.value)}
                        className={[
                          'w-[38px] text-center text-[11px] py-[2px] bg-transparent rounded border font-sans outline-none',
                          played ? 'border-[#4caf7d40]' : 'border-ak-border',
                          c.key === 'eff' ? 'text-ak-red-text' : 'text-ak-text-sub',
                        ].join(' ')}
                      />
                    ) : (
                      <span className={c.key === 'eff' ? 'text-ak-red-text' : 'text-ak-text-sub'}>{row[c.key] ?? 0}</span>
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
    <div className="w-8 h-8 rounded-full border-2 border-ak-border2 border-t-ak-red-bright animate-ak-spin" />
  );
}

// ─── TurnstileWidget ─────────────────────────────────────────────────────────
export function TurnstileWidget({ onVerified, onExpired }: { onVerified: (token: string) => void; onExpired: () => void }) {
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

// ─── LoginForm ────────────────────────────────────────────────────────────────
export function LoginForm({ onLogin, error }: { onLogin: any; error: any }) {
  const [username,      setUsername]      = useState('');
  const [password,      setPassword]      = useState('');
  const [totpToken,     setTotpToken]     = useState('');
  const [loading,       setLoading]       = useState(false);
  const [failCount,     setFailCount]     = useState(0);
  const [captchaToken,  setCaptchaToken]  = useState<string | null>(null);

  const needsCaptcha = failCount >= 3;

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const result = await onLogin(username, password, totpToken, captchaToken);
    if (result?.failed) setFailCount(c => c + 1);
    if (result?.requiresCaptcha) setCaptchaToken(null);
    setLoading(false);
  };

  const inputCls = 'w-full py-[9px] px-3 text-[13px] rounded-lg border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none';
  const labelCls = 'block text-[10px] font-black tracking-[0.15em] mb-[5px] text-ak-text-dim uppercase';

  return (
    <div className="w-full max-w-[360px] rounded-[20px] p-8 border border-ak-border bg-ak-surface">
      <div className="text-center mb-7">
        <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center mx-auto mb-3 text-[22px] bg-[#8b1a1a18] border border-[#8b1a1a45]">🔐</div>
        <div className="text-[22px] font-black text-ak-text">Admin Access</div>
        <div className="text-xs text-ak-text-dim mt-1">Armani Katehano · Team Manager</div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-[14px]">
        <div>
          <label className={labelCls}>Username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" autoComplete="username" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Authenticator code</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={totpToken} onChange={e => setTotpToken(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" autoComplete="one-time-code" className={inputCls} />
        </div>
        {needsCaptcha && (
          <TurnstileWidget
            onVerified={setCaptchaToken}
            onExpired={() => setCaptchaToken(null)}
          />
        )}
        {error && <div className="text-xs text-ak-red-text">{error}</div>}
        <button type="submit" disabled={loading || !username || !password || (needsCaptcha && !captchaToken)}
          className={[
            'py-3 font-black text-[14px] tracking-[0.12em] uppercase rounded-[10px] border-0 bg-ak-red text-ak-text font-sans',
            (loading || !username || !password || (needsCaptcha && !captchaToken)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer opacity-100',
          ].join(' ')}>
          {loading ? 'VERIFYING...' : 'SIGN IN'}
        </button>
      </form>
      <div className="text-center text-[10px] text-ak-text-dim mt-4">5 failed attempts -> 15-minute lockout</div>
    </div>
  );
}

// ─── Btn ──────────────────────────────────────────────────────────────────────
const BTN_VARIANT: Record<string, string> = {
  primary:   'bg-ak-red border-transparent text-ak-text',
  danger:    'bg-[#7f1d1d] border-transparent text-ak-text',
  ghost:     'bg-transparent border-ak-border2 text-ak-text-sub',
  secondary: 'bg-ak-surface2 border-transparent text-ak-text',
  green:     'bg-ak-green border-transparent text-ak-text',
};

const BTN_SIZE: Record<string, string> = {
  sm: 'py-[6px] px-3 text-[11px]',
  md: 'py-[9px] px-[18px] text-[13px]',
};

export function Btn({ onClick, disabled = false, children, variant = 'primary', size = 'md' }: { onClick?: any; disabled?: boolean; children: any; variant?: string; size?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className={[
      'font-black tracking-[0.12em] rounded-lg border font-sans transition-opacity duration-150',
      BTN_VARIANT[variant] ?? BTN_VARIANT.primary,
      BTN_SIZE[size] ?? BTN_SIZE.md,
      disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer opacity-100',
    ].join(' ')}>
      {children}
    </button>
  );
}

// ─── F (field input) ──────────────────────────────────────────────────────────
export function F({ label, value, onChange, type = 'text', placeholder = '' }: { label: any; value: any; onChange: any; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-1">{label}</span>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full py-[7px] px-[10px] text-xs rounded-[7px] border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none" />
    </label>
  );
}

// ─── Sel (select) ─────────────────────────────────────────────────────────────
export function Sel({ label, value, onChange, options = [] }: { label: any; value: any; onChange: any; options?: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="block text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-1">{label}</span>
      <select value={value ?? ''} onChange={e => onChange(e.target.value)}
        className="w-full py-[7px] px-[10px] text-xs rounded-[7px] border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

// ─── Confirm ──────────────────────────────────────────────────────────────────
export function Confirm({ msg, onConfirm, onCancel }: { msg: any; onConfirm: any; onCancel: any }) {
  if (!msg) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
      <div className="bg-ak-surface p-8 rounded-xl max-w-[400px] w-[90%] border border-ak-border2">
        <p className="mb-6 text-ak-text text-[14px]">{msg}</p>
        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm}>Confirm</Btn>
        </div>
      </div>
    </div>
  );
}
