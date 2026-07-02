import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function EnrollPage() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/auth/player/invite-info?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) {
          setError((await r.json()).error ?? "Invalid link");
          return;
        }
        setPlayerName((await r.json()).playerName);
      })
      .catch(() => setError("Network error"));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 12) return setError("Password must be at least 12 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setSubmitting(true);
    const r = await fetch("/api/auth/player/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token, password }),
    });
    setSubmitting(false);
    if (!r.ok) return setError((await r.json()).error ?? "Enrollment failed");
    router.replace("/");
  }

  if (!token) return <main><p>Missing or invalid link.</p></main>;
  if (error && !playerName) return <main><p>{error}</p></main>;
  if (!playerName) return <main><p>Loading...</p></main>;

  return (
    <main>
      <h1>Welcome, {playerName}</h1>
      <p>Choose a password to activate your account.</p>
      <form onSubmit={submit}>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={12}
            required
            autoFocus
          />
        </label>
        <label>
          Confirm
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={12}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Setting..." : "Set password"}
        </button>
      </form>
    </main>
  );
}
