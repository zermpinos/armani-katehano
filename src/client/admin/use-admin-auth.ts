import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "./csrf";

export function useAdminAuth(slug: any) {
  const [authed,     setAuthed]  = useState(false);
  const [loading,    setLoading] = useState(true);
  const [loginError, setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth")
      .then(r => { if (r.ok) setAuthed(true); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = useCallback(async (username: string, password: string, totpToken: string, captchaToken?: string | null) => {
    setError(null);
    const res = await apiFetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        setError(body.error ?? "Invalid credentials.");
      }
      return { failed: true, requiresCaptcha: body.requiresCaptcha ?? false };
    }
  }, [slug]);

  const handleLogout = useCallback(() => {
    apiFetch("/api/auth", { method: "DELETE" }).finally(() => setAuthed(false));
  }, []);

  return { authed, loading, loginError, handleLogin, handleLogout };
}
