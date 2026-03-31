/**
 * pages/admin/[slug]/import.js
 * Accepts the scraper JSON, POSTs it to /api/admin/import, and shows the result.
 */

import { useState } from "react";
import { C } from "../../../lib/theme";
import { AdminLayout, Btn, Spinner, LoginForm, useAdminAuth } from "../../../lib/adminShared";
import { validateAdminSlug } from "../../../lib/adminSlugCheck.js";

export default function ImportPage({ validSlug }) {
  const slug = typeof window !== "undefined" ? window.location.pathname.split("/")[2] : "";

  const { authed, loading: checking, loginError, handleLogin } = useAdminAuth(slug);

  const [toast,    setToast]    = useState(null);
  const [jsonText, setJsonText] = useState("");
  const [phase,    setPhase]    = useState("idle"); // idle | saving | done
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState("");

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const submit = async () => {
    setError("");
    setResult(null);

    let parsed;
    try {
      parsed = JSON.parse(jsonText.trim());
    } catch {
      setError("Invalid JSON -- could not parse input.");
      return;
    }

    setPhase("saving");
    try {
      const res = await fetch("/api/admin/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ data: parsed }),
      });

      const d = await res.json();

      if (res.status === 409) {
        setError(`Already imported -- game ID: ${d.gameId}`);
        setPhase("idle");
        return;
      }

      if (!res.ok) {
        setError(d.error || "Import failed.");
        setPhase("idle");
        return;
      }

      setResult(d);
      setPhase("done");
      showToast("Game imported!");
    } catch {
      setError("Network error -- could not reach the server.");
      setPhase("idle");
    }
  };

  const reset = () => {
    setJsonText("");
    setError("");
    setResult(null);
    setPhase("idle");
  };

  if (!validSlug) return null;

  if (checking) return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </div>
  );

  if (!authed) return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <LoginForm onLogin={handleLogin} error={loginError} />
    </div>
  );

  return (
    <AdminLayout slug={slug} title="Import" toast={toast} setToast={setToast}>
      <div style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 4 }}>Import game</div>
          <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>
            Run your scraper, then paste the JSON output below.
          </div>
        </div>

        {phase !== "done" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, textTransform: "uppercase" }}>
              Paste scraper JSON
            </div>
            <textarea
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              placeholder='{"url": "...", "game": {...}, "teams": [...]}'
              style={{
                width: "100%", minHeight: 200, fontSize: 11, fontFamily: "monospace",
                padding: 12, borderRadius: 8, border: `1px solid ${C.border2}`,
                background: C.base, color: C.text, resize: "vertical",
              }}
            />
            {error && (
              <div style={{
                fontSize: 12, color: C.redText, padding: "8px 12px",
                borderRadius: 8, background: `${C.red}18`, border: `1px solid ${C.red}40`,
              }}>
                {error}
              </div>
            )}
            <div>
              <Btn onClick={submit} disabled={!jsonText.trim() || phase === "saving"}>
                {phase === "saving" ? "IMPORTING..." : "IMPORT"}
              </Btn>
            </div>
          </div>
        )}

        {phase === "done" && result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
              padding: "14px 18px", borderRadius: 10,
              background: `${C.green ?? "#22c55e"}18`,
              border: `1px solid ${C.green ?? "#22c55e"}40`,
            }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: C.text, marginBottom: 8 }}>
                ✓ Game imported
              </div>
              <div style={{ fontSize: 12, color: C.textDim, display: "flex", flexDirection: "column", gap: 4 }}>
                <div>Players imported: <strong style={{ color: C.text }}>{result.playersImported}</strong></div>
                {result.skipped?.length > 0 && (
                  <div style={{ color: C.redText }}>
                    Skipped (no DB match): {result.skipped.join(", ")}
                  </div>
                )}
              </div>
            </div>
            <div><Btn onClick={reset}>IMPORT ANOTHER</Btn></div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export async function getServerSideProps({ params }) {
  const validSlug = await validateAdminSlug(params.slug);
  return { props: { validSlug } };
}