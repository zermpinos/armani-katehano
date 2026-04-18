/**
 * pages/unsubscribe.tsx
 *
 * Public page -- landing target for the unsubscribe link included in every
 * roster announcement email.
 *
 * Reads ?token=<hex> from the URL, calls DELETE /api/subscribe, and shows a
 * confirmation. No auth required.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { C } from "../lib/theme";

export default function UnsubscribePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "done" | "error">("pending");

  useEffect(() => {
    if (!router.isReady) return;

    const token = router.query.token;
    if (!token || typeof token !== "string") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("error");
      return;
    }

    // Strip token from URL before any network call so it never appears in
    // browser history, Referer headers, or Sentry breadcrumbs.
    history.replaceState(null, "", "/unsubscribe");

    fetch("/api/subscribe", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token }),
    })
      .then(res => setStatus(res.ok ? "done" : "error"))
      .catch(() => setStatus("error"));
  }, [router.isReady, router.query.token]);

  return (
    <>
      <Head>
        <title>Unsubscribe -- Armani Katehano</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div style={{
        minHeight: "100vh", background: C.base, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        <div style={{
          maxWidth: 420, width: "100%", borderRadius: 16, padding: "36px 32px",
          border: `1px solid ${C.border}`, background: C.surface, textAlign: "center",
        }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>
            {status === "pending" ? "⏳" : status === "done" ? "✅" : "⚠️"}
          </div>

          {status === "pending" && (
            <>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 8 }}>Unsubscribing...</div>
              <div style={{ fontSize: 13, color: C.textDim }}>Please wait.</div>
            </>
          )}

          {status === "done" && (
            <>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 8 }}>You&apos;ve been unsubscribed</div>
              <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6 }}>
                You won&apos;t receive any more roster notifications.<br />
                You can re-subscribe any time from the homepage.
              </div>
              <Link
                href="/"
                style={{ display: "inline-block", marginTop: 20, padding: "8px 20px", borderRadius: 8, background: C.red, color: C.text, fontSize: 12, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}
              >
                Back to site
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.redText, marginBottom: 8 }}>Link invalid or expired</div>
              <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6 }}>
                This unsubscribe link may have already been used or is no longer valid.
                If you&apos;re still receiving emails, contact us.
              </div>
              <Link
                href="/"
                style={{ display: "inline-block", marginTop: 20, padding: "8px 20px", borderRadius: 8, background: C.surface2, color: C.text, fontSize: 12, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", border: `1px solid ${C.border2}` }}
              >
                Back to site
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
