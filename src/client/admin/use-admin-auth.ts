import { useState, useCallback } from "react";
import { apiFetch } from "./csrf";

export function useAdminAuth(slug: string, initialAuthed: boolean) {
  const [authed,     setAuthed] = useState(initialAuthed);
  const [loginError, setError]  = useState<string | null>(null);

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

  const handlePasskeyLogin = useCallback(async (): Promise<{ failed: boolean; error?: string }> => {
    setError(null);
    try {
      const optRes = await fetch("/api/auth/passkey/auth-options", { method: "POST" });
      if (!optRes.ok) {
        if (optRes.status === 429) {
          const body = await optRes.json().catch(() => ({}));
          setError(`Too many attempts. Try again in ${Math.ceil((body.retryAfter || 60) / 60)} min.`);
        } else {
          setError("Authentication failed. Try again.");
        }
        return { failed: true };
      }
      const { options, challengeId } = await optRes.json();

      const { startAuthentication } = await import("@simplewebauthn/browser");
      const response = await startAuthentication({ optionsJSON: options });

      const verRes = await apiFetch("/api/auth/passkey/auth-verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ challengeId, response }),
      });

      if (verRes.ok) {
        setAuthed(true);
        return { failed: false };
      }

      const body = await verRes.json().catch(() => ({}));
      setError("Authentication failed. Try again.");
      return { failed: true, error: body.error };
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        setError(null);
        return { failed: true, error: "cancelled" };
      }
      setError("Authentication failed. Try again.");
      return { failed: true };
    }
  }, []);

  const handleLogout = useCallback(() => {
    apiFetch("/api/auth", { method: "DELETE" }).finally(() => setAuthed(false));
  }, []);

  return { authed, setAuthed, loginError, handleLogin, handlePasskeyLogin, handleLogout };
}
