import { useState, useEffect, useCallback } from "react";
import { useRouter }  from "next/router";
import {
  AdminLayout, Spinner, LoginForm, Btn, useAdminAuth, apiFetch,
} from "@/client/admin";
import { validateAdminSlug } from "@/server/auth";

type BroadcastLogRow = {
  id:             string;
  subject:        string;
  recipientCount: number;
  deliveredCount: number;
  failedCount:    number;
  sentAt:         string;
  sentToAll:      boolean;
};

type ResolveResult = {
  matched:        number;
  unmatchedCount: number;
  unmatched:      string[];
};

type PageMode = "compose" | "confirming" | "sending";

export default function BroadcastPage({ validSlug, maskedAdminEmail }: { validSlug: boolean; maskedAdminEmail: string }) {
  const router = useRouter();
  const slug   = router.query.slug || validSlug;
  const { authed, loading: authLoading, loginError, handleLogin, handleLogout } = useAdminAuth(slug);

  const [subject,        setSubject]        = useState("");
  const [body,           setBody]           = useState("");
  const [recipientMode,  setRecipientMode]  = useState<"all" | "specific">("all");
  const [specificEmails, setSpecificEmails] = useState("");

  const [renderedHtml,   setRenderedHtml]   = useState<string | null>(null);
  const [previewKey,     setPreviewKey]     = useState<string | null>(null);
  const [sendingPreview, setSendingPreview] = useState(false);

  const [resolveResult,   setResolveResult]   = useState<ResolveResult | null>(null);
  const [resolvedForText, setResolvedForText]  = useState<string | null>(null);
  const [resolving,       setResolving]        = useState(false);

  const [mode,           setMode]           = useState<PageMode>("compose");
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null);
  const [logs,           setLogs]           = useState<BroadcastLogRow[]>([]);
  const [toast,          setToast]          = useState<{ msg: string; type?: string } | null>(null);

  const [sanitizedHtml, setSanitizedHtml] = useState("");

  const currentKey     = subject + "|" + body;
  const previewCurrent = previewKey === currentKey && renderedHtml !== null;
  const resolveCurrent = resolvedForText === specificEmails && resolveResult !== null;

  const canReview =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    previewCurrent &&
    (recipientMode === "all" || (recipientMode === "specific" && resolveCurrent && resolveResult!.matched > 0));

  const fetchHistory = useCallback(async () => {
    try {
      const res  = await fetch("/api/admin/broadcast?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch {}
  }, []);

  const fetchCount = useCallback(async () => {
    try {
      const res  = await fetch("/api/admin/subscribers?status=confirmed&limit=1");
      if (!res.ok) return;
      const data = await res.json();
      setConfirmedCount(data.total ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (!authed) return;
    void Promise.all([fetchHistory(), fetchCount()]);
  }, [authed, fetchHistory, fetchCount]);

  useEffect(() => {
    if (!renderedHtml) { setSanitizedHtml(""); return; }
    import("dompurify").then(({ default: DOMPurify }) => {
      setSanitizedHtml(DOMPurify.sanitize(renderedHtml, {
        ALLOWED_TAGS: ["p","h1","h2","h3","h4","h5","h6","ul","ol","li","a","strong","em","code","pre","blockquote","br","hr"],
        ALLOWED_ATTR: ["href"],
      }));
    });
  }, [renderedHtml]);

  const handleSubjectChange = (v: string) => {
    setSubject(v);
    setPreviewKey(null);
    setRenderedHtml(null);
  };
  const handleBodyChange = (v: string) => {
    setBody(v);
    setPreviewKey(null);
    setRenderedHtml(null);
  };
  const handleSpecificEmailsChange = (v: string) => {
    setSpecificEmails(v);
    setResolveResult(null);
    setResolvedForText(null);
  };

  const handleSendPreview = async () => {
    setSendingPreview(true);
    try {
      const res = await apiFetch("/api/admin/broadcast", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "preview", subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setRenderedHtml(data.renderedHtml);
      setPreviewKey(currentKey);
      setToast({ msg: `Preview sent to ${maskedAdminEmail}` });
    } catch (err: any) {
      setToast({ msg: err.message ?? "Preview failed", type: "error" });
    } finally {
      setSendingPreview(false);
    }
  };

  const handleCheckRecipients = async () => {
    const emails = specificEmails
      .split(/[\n,]+/)
      .map(e => e.trim())
      .filter(Boolean);
    if (emails.length === 0) return;
    setResolving(true);
    try {
      const res = await apiFetch("/api/admin/broadcast", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "resolve", targetEmails: emails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check failed");
      setResolveResult(data);
      setResolvedForText(specificEmails);
    } catch (err: any) {
      setToast({ msg: err.message ?? "Recipient check failed", type: "error" });
    } finally {
      setResolving(false);
    }
  };

  const handleSend = async () => {
    setMode("sending");
    try {
      const payload: any = { mode: "send", subject, body };
      if (recipientMode === "specific") {
        payload.targetEmails = specificEmails
          .split(/[\n,]+/)
          .map((e: string) => e.trim())
          .filter(Boolean);
      }
      const res = await apiFetch("/api/admin/broadcast", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      const msg = data.failed > 0
        ? `Delivered to ${data.delivered}, ${data.failed} failed`
        : `Delivered to ${data.delivered} subscribers`;
      setToast({ msg });
      setSubject(""); setBody(""); setSpecificEmails("");
      setRenderedHtml(null); setPreviewKey(null);
      setResolveResult(null); setResolvedForText(null);
      setMode("compose");
      void fetchHistory();
    } catch (err: any) {
      setToast({ msg: err.message ?? "Send failed", type: "error" });
      setMode("compose");
    }
  };

  if (!validSlug) return null;

  if (authLoading)
    return <div className="min-h-screen flex items-center justify-center bg-ak-base"><Spinner /></div>;

  if (!authed)
    return (
      <div className="min-h-screen flex items-center justify-center bg-ak-base p-4">
        <LoginForm onLogin={handleLogin} error={loginError} />
      </div>
    );

  const recipientLabel = recipientMode === "all"
    ? `All confirmed subscribers${confirmedCount !== null ? ` (${confirmedCount})` : ""}`
    : resolveResult
      ? `${resolveResult.matched} specific subscriber${resolveResult.matched !== 1 ? "s" : ""}`
      : "Specific subscribers";

  return (
    <AdminLayout slug={slug} title="Broadcast" toast={toast} setToast={setToast} onLogout={handleLogout}>

      {mode !== "sending" && (
        <>
          <div className="mb-6">
            <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[2px]">Broadcast</div>
            <div className="text-[22px] font-black text-ak-text">New Email</div>
          </div>

          {mode === "compose" && (
            <div className="space-y-5 max-w-[720px]">
              <div>
                <label className="block text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[6px]">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => handleSubjectChange(e.target.value)}
                  maxLength={200}
                  placeholder="Email subject..."
                  className="w-full py-[9px] px-[12px] text-sm rounded-[8px] border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none"
                />
                {subject.length >= 180 && (
                  <div className={`text-[11px] mt-1 ${subject.length >= 200 ? "text-red-500" : "text-ak-text-dim"}`}>
                    {subject.length}/200
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[6px]">Body (Markdown)</label>
                <textarea
                  value={body}
                  onChange={e => handleBodyChange(e.target.value)}
                  maxLength={50_000}
                  rows={10}
                  placeholder="Write your message in Markdown..."
                  className="w-full py-[9px] px-[12px] text-sm rounded-[8px] border border-ak-border2 bg-ak-base text-ak-text font-mono outline-none resize-y"
                />
                {body.length >= 48_000 && (
                  <div className={`text-[11px] mt-1 ${body.length >= 50_000 ? "text-red-500" : "text-ak-text-dim"}`}>
                    {body.length.toLocaleString()}/50,000
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[6px]">Recipients</label>
                <div className="flex rounded-[7px] border border-ak-border2 overflow-hidden mb-3 w-fit">
                  {(["all", "specific"] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => { setRecipientMode(m); setResolveResult(null); setResolvedForText(null); }}
                      className={[
                        "px-4 py-[7px] text-[11px] font-black tracking-[0.1em] uppercase font-sans border-0 cursor-pointer",
                        recipientMode === m ? "bg-ak-surface text-ak-text" : "bg-ak-base text-ak-text-dim",
                      ].join(" ")}
                    >
                      {m === "all" ? "All confirmed" : "Specific"}
                    </button>
                  ))}
                </div>

                {recipientMode === "all" && confirmedCount !== null && (
                  <p className="text-[12px] text-ak-text-dim">
                    Will send to <strong className="text-ak-text">{confirmedCount}</strong> confirmed subscriber{confirmedCount !== 1 ? "s" : ""}.
                    Actual count may differ slightly at send time.
                  </p>
                )}

                {recipientMode === "specific" && (
                  <div>
                    <textarea
                      value={specificEmails}
                      onChange={e => handleSpecificEmailsChange(e.target.value)}
                      rows={4}
                      placeholder="One email per line, or comma-separated..."
                      className="w-full py-[9px] px-[12px] text-sm rounded-[8px] border border-ak-border2 bg-ak-base text-ak-text font-mono outline-none resize-y mb-2"
                    />
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={handleCheckRecipients}
                      disabled={resolving || !specificEmails.trim()}
                    >
                      {resolving ? "Checking..." : "Check recipients"}
                    </Btn>
                    {resolveResult && resolveCurrent && (
                      <div className="mt-2 text-[12px]">
                        <span className="text-ak-text">
                          <strong>{resolveResult.matched}</strong> matched confirmed subscriber{resolveResult.matched !== 1 ? "s" : ""}
                        </span>
                        {resolveResult.unmatchedCount > 0 && (
                          <span className="text-ak-text-dim ml-2">
                            ({resolveResult.unmatchedCount} unmatched
                            {resolveResult.unmatched.length > 0 && `: ${resolveResult.unmatched.slice(0, 5).join(", ")}${resolveResult.unmatchedCount > 5 ? ` + ${resolveResult.unmatchedCount - 5} more` : ""}`})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Btn variant="ghost" onClick={handleSendPreview} disabled={sendingPreview || !subject.trim() || !body.trim()}>
                  {sendingPreview ? "Sending preview..." : `Send preview to ${maskedAdminEmail}`}
                </Btn>
                <Btn variant="primary" onClick={() => setMode("confirming")} disabled={!canReview}>
                  Review &amp; send ->
                </Btn>
              </div>
              {!previewCurrent && subject.trim() && body.trim() && (
                <p className="text-[11px] text-ak-text-dim">Send a preview first to enable sending.</p>
              )}
            </div>
          )}

          {mode === "confirming" && (
            <div className="max-w-[720px] space-y-5">
              <div className="rounded-[10px] border border-ak-border bg-ak-surface p-5 space-y-3">
                <div>
                  <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[4px]">Subject</div>
                  <div className="text-[15px] font-bold text-ak-text">{subject}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[4px]">Recipients</div>
                  <div className="text-[13px] text-ak-text">{recipientLabel}</div>
                  <div className="text-[11px] text-ak-text-dim mt-[2px]">Count is best-effort -- actual send targets whoever is confirmed at send time.</div>
                </div>
              </div>

              {sanitizedHtml ? (
                <div>
                  <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[6px]">Preview</div>
                  <div
                    className="rounded-[10px] border border-ak-border bg-white p-5 prose prose-sm max-w-none text-[14px]"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                </div>
              ) : (
                <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
                  You haven&apos;t sent a preview yet. Are you sure you want to proceed?
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMode("compose")}
                  className="text-[12px] font-bold text-ak-text-dim bg-transparent border-0 cursor-pointer"
                >
                  ← Back
                </button>
                <Btn variant="primary" onClick={handleSend}>
                  Send to {recipientMode === "specific" && resolveResult
                    ? `${resolveResult.matched} subscriber${resolveResult.matched !== 1 ? "s" : ""}`
                    : `${confirmedCount ?? "..."} subscribers`}
                </Btn>
              </div>
            </div>
          )}
        </>
      )}

      {mode === "sending" && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Spinner />
          <p className="text-[13px] text-ak-text-dim">Sending...</p>
        </div>
      )}

      <div className="mt-10">
        <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-3">Broadcast History</div>
        {logs.length === 0 ? (
          <div className="text-[13px] text-ak-text-dim py-6 text-center">No broadcasts sent yet.</div>
        ) : (
          <div className="border border-ak-border rounded-[10px] overflow-hidden">
            <div className="flex items-center py-[8px] px-[14px] bg-ak-surface2 border-b border-ak-border">
              <span className="flex-1 text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase">Subject</span>
              <span className="w-[80px] text-right text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase">Recipients</span>
              <span className="w-[80px] text-right text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase ml-3">Delivered</span>
              <span className="w-[60px] text-right text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase ml-3">Failed</span>
              <span className="w-[100px] text-right text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase ml-3">Sent at</span>
            </div>
            {logs.map((log, i) => (
              <div
                key={log.id}
                className={[
                  "flex items-center py-[9px] px-[14px]",
                  i % 2 === 0 ? "bg-ak-surface" : "bg-ak-surface2",
                  i === 0 ? "" : "border-t border-ak-border",
                ].join(" ")}
              >
                <span className="flex-1 text-[13px] text-ak-text truncate pr-3">{log.subject}</span>
                <span className="w-[80px] text-right text-[11px] text-ak-text-dim">{log.recipientCount}</span>
                <span className="w-[80px] text-right text-[11px] text-ak-text-dim ml-3">{log.deliveredCount}</span>
                <span className={`w-[60px] text-right text-[11px] ml-3 ${log.failedCount > 0 ? "text-red-500" : "text-ak-text-dim"}`}>
                  {log.failedCount}
                </span>
                <span className="w-[100px] text-right text-[11px] text-ak-text-dim whitespace-nowrap ml-3">
                  {new Date(log.sentAt).toLocaleDateString("el-GR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </AdminLayout>
  );
}

export async function getServerSideProps({ params }: { params: { slug: string } }) {
  const validSlug = await validateAdminSlug(params.slug);
  if (!validSlug) return { notFound: true };

  const rawEmail       = process.env.ADMIN_ALERT_EMAIL ?? "webmaster@armani-katehano.com";
  const at             = rawEmail.indexOf("@");
  const maskedAdminEmail = at >= 0 ? `***@${rawEmail.slice(at + 1)}` : "***";

  return { props: { validSlug, maskedAdminEmail } };
}
