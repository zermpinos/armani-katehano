/**
 * pages/unsubscribe.tsx
 *
 * Public page — landing target for the unsubscribe link included in every
 * game email (roster announcement or post-game recap).
 *
 * Reads ?token=<hex> from the URL, calls DELETE /api/subscribe, and shows a
 * confirmation. No auth required.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";

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
        <title>Unsubscribe — Armani Katehano</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-ak-base flex items-center justify-center p-6">
        <div className="max-w-[420px] w-full rounded-2xl py-9 px-8 border border-ak-border bg-ak-surface text-center">
          <div className="text-4xl mb-4">
            {status === "pending" ? "⏳" : status === "done" ? "✅" : "⚠️"}
          </div>

          {status === "pending" && (
            <>
              <div className="text-lg font-black text-ak-text mb-2">Unsubscribing…</div>
              <div className="text-[13px] text-ak-text-dim">Please wait.</div>
            </>
          )}

          {status === "done" && (
            <>
              <div className="text-lg font-black text-ak-text mb-2">You&apos;ve been unsubscribed</div>
              <div className="text-[13px] text-ak-text-dim leading-relaxed">
                You won&apos;t receive any more game emails.<br />
                You can re-subscribe any time from the homepage.
              </div>
              <Link
                href="/"
                className="inline-block mt-5 px-5 py-2 rounded-lg bg-ak-red text-ak-text text-xs font-black tracking-[0.1em] uppercase no-underline"
              >
                Back to site
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-lg font-black text-ak-red-text mb-2">Link invalid or expired</div>
              <div className="text-[13px] text-ak-text-dim leading-relaxed">
                This unsubscribe link may have already been used or is no longer valid.
                If you&apos;re still receiving emails, contact us.
              </div>
              <Link
                href="/"
                className="inline-block mt-5 px-5 py-2 rounded-lg bg-ak-surface2 text-ak-text text-xs font-black tracking-[0.1em] uppercase no-underline border border-ak-border2"
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
