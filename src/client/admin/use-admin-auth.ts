import { useState, useCallback } from "react";
import { apiFetch } from "./csrf";

export function useAdminAuth(slug: string, initialAuthed: boolean) {
  const [authed,     setAuthed] = useState(initialAuthed);
  const [loginError, setError]  = useState<string | null>(null);

  const handleLogin = useCallback(async (username: string, password: string, captchaToken?: string | null) => {
    setError(null);
    const res = await apiFetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, slug, captchaToken }),
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

  return { authed, setAuthed, loginError, handleLogin, handleLogout };
}
