import { useState, useEffect, useCallback } from "react";
import { coachFetch } from "./csrf";

export function useCoachAuth() {
  const [authed,     setAuthed]     = useState(false);
  const [checking,   setChecking]   = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

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

  return { authed, checking, loginError, handleLogin, handleLogout };
}
