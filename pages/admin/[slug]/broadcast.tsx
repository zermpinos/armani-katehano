import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/router";
import {
  AdminLayout, Spinner, PasskeyLoginForm, Btn, useAdminAuth, apiFetch,
} from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";

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

export default function BroadcastPage({
  validSlug, showFallback, noPasskeys, maskedAdminEmail,
}: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean; maskedAdminEmail: string }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [subject,        setSubject]        = useState("");
  const [body,           setBody]           = useState("");
  const [recipientMode,  setRecipientMode]  = useState<"all" | "specific">("all");
  const [specificEmails, setSpecificEmails] = useState("");

  const [renderedHtml,   setRenderedHtml]   = useState<string | null>(null);
  const [previewKey,     setPreviewKey]     = useState<string | null>(null);
  const [sendingPreview, setSendingPreview] = useState(false);

  const [resolveResult,   setResolveResult]   = useState<ResolveResult | null>(null);
  const [resolvedForText, setResolvedForText] = useState<string | null>(null);
  const [resolving,       setResolving]       = useState(false);

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

  const handleSubjectChange = (v: string) => { setSubject(v); setPreviewKey(null); setRenderedHtml(null); };
  const handleBodyChange    = (v: string) => { setBody(v);    setPreviewKey(null); setRenderedHtml(null); };
  const handleSpecificEmailsChange = (v: string) => { setSpecificEmails(v); setResolveResult(null); setResolvedForText(null); };

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
      setToast({ msg: `Preview sent to ${maskedAdminEmail}`, type: "success" });
    } catch (err: any) {
      setToast({ msg: err.message ?? "Preview failed", type: "error" });
    } finally {
      setSendingPreview(false);
    }
  };

  const handleCheckRecipients = async () => {
    const emails = specificEmails.split(/[\n,]+/).map(e => e.trim()).filter(Boolean);
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
        payload.targetEmails = specificEmails.split(/[\n,]+/).map((e: string) => e.trim()).filter(Boolean);
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
      setToast({ msg, type: "success" });
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
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base"><Spinner /></div>
  );
  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base p-4">
      <PasskeyLoginForm onPasskeyLogin={handlePasskeyLogin} onFallbackLogin={handleLogin} loginError={loginError} showFallback={showFallback} noPasskeys={noPasskeys} />
    </div>
  );

  const recipientLabel = recipientMode === "all"
    ? `All confirmed subscribers${confirmedCount !== null ? ` (${confirmedCount})` : ""}`
    : resolveResult
      ? `${resolveResult.matched} specific subscriber${resolveResult.matched !== 1 ? "s" : ""}`
      : "Specific subscribers";

  return (
    <AdminLayout slug={slug} title="Broadcast" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <h1 className="text-[22px] md:text-[28px] font-black text-ak-text mb-6">Broadcast</h1>

      {mode === "sending" ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Spinner />
          <p className="text-[13px] text-ak-text-dim">Sending...</p>
        </div>
      ) : (
        <>
          {mode === "compose" && (
            <Panel label="New email">
              <FieldLabel>Subject</FieldLabel>
              <input
                type="text"
                value={subject}
                onChange={e => handleSubjectChange(e.target.value)}
                maxLength={200}
                placeholder="Email subject..."
                className="w-full py-[9px] px-[12px] text-sm rounded-[8px] border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none"
              />
              {subject.length >= 180 && (
                <div className={["text-[11px] mt-1", subject.length >= 200 ? "text-ak-red-text" : "text-ak-text-dim"].join(" ")}>
                  {subject.length}/200
                </div>
              )}

              <div className="mt-5">
                <FieldLabel>Body (Markdown)</FieldLabel>
                <textarea
                  value={body}
                  onChange={e => handleBodyChange(e.target.value)}
                  maxLength={50_000}
                  rows={10}
                  placeholder="Write your message in Markdown..."
                  className="w-full py-[9px] px-[12px] text-sm rounded-[8px] border border-ak-border2 bg-ak-base text-ak-text font-mono outline-none resize-y"
                />
                {body.length >= 48_000 && (
                  <div className={["text-[11px] mt-1", body.length >= 50_000 ? "text-ak-red-text" : "text-ak-text-dim"].join(" ")}>
                    {body.length.toLocaleString()}/50,000
                  </div>
                )}
              </div>

              <div className="mt-5">
                <FieldLabel>Recipients</FieldLabel>
                <div className="flex rounded-[7px] border border-ak-border2 overflow-hidden mb-3 w-fit">
                  {(["all", "specific"] as const).map(m => {
                    const active = recipientMode === m;
                    return (
                      <button
                        key={m}
                        onClick={() => { setRecipientMode(m); setResolveResult(null); setResolvedForText(null); }}
                        className={[
                          "px-4 py-[7px] text-[11px] font-black tracking-[0.1em] uppercase font-sans border-0 cursor-pointer",
                          active ? "bg-ak-surface text-ak-text" : "bg-ak-base text-ak-text-dim",
                        ].join(" ")}
                      >
                        {m === "all" ? "All confirmed" : "Specific"}
                      </button>
                    );
                  })}
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
                      {resolving ? "CHECKING..." : "CHECK RECIPIENTS"}
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

              <div className="flex items-center gap-3 flex-wrap mt-6 pt-4 border-t border-ak-border">
                <Btn variant="ghost" onClick={handleSendPreview} disabled={sendingPreview || !subject.trim() || !body.trim()}>
                  {sendingPreview ? "SENDING PREVIEW..." : `SEND PREVIEW TO ${maskedAdminEmail.toUpperCase()}`}
                </Btn>
                <Btn variant="primary" onClick={() => setMode("confirming")} disabled={!canReview}>
                  REVIEW &amp; SEND
                </Btn>
              </div>
              {!previewCurrent && subject.trim() && body.trim() && (
                <p className="text-[11px] text-ak-text-dim mt-2">Send a preview first to enable sending.</p>
              )}
            </Panel>
          )}

          {mode === "confirming" && (
            <Panel label="Review">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div>
                  <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[4px]">Subject</div>
                  <div className="text-[14px] font-bold text-ak-text">{subject}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[4px]">Recipients</div>
                  <div className="text-[13px] text-ak-text">{recipientLabel}</div>
                  <div className="text-[11px] text-ak-text-dim mt-[2px]">Count is best-effort; actual send targets whoever is confirmed at send time.</div>
                </div>
              </div>

              {sanitizedHtml ? (
                <div>
                  <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[6px]">Preview</div>
                  <div
                    className="rounded-[10px] border border-ak-border bg-white p-5 text-[14px] text-black prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                </div>
              ) : (
                <div className="rounded-[10px] border border-[#c9a84c55] bg-[#c9a84c12] p-4 text-[13px] text-ak-gold">
                  You have not sent a preview yet. Are you sure you want to proceed?
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap mt-6 pt-4 border-t border-ak-border">
                <Btn variant="ghost" onClick={() => setMode("compose")}>
                  ← BACK
                </Btn>
                <Btn variant="primary" onClick={handleSend}>
                  SEND TO {recipientMode === "specific" && resolveResult
                    ? `${resolveResult.matched} SUBSCRIBER${resolveResult.matched !== 1 ? "S" : ""}`
                    : `${confirmedCount ?? "..."} SUBSCRIBERS`}
                </Btn>
              </div>
            </Panel>
          )}

          <HistorySection logs={logs} />
        </>
      )}
    </AdminLayout>
  );
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ak-border bg-ak-surface p-4 md:p-5 mb-5">
      <div className="text-[10px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-3">{label}</div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[6px]">
      {children}
    </label>
  );
}

function HistorySection({ logs }: { logs: BroadcastLogRow[] }) {
  return (
    <section className="mt-8">
      <div className="text-[10px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-3">History</div>
      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-8 text-center text-[12px] text-ak-text-dim">
          No broadcasts sent yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {logs.map(log => (
            <li key={log.id}>
              <article className="rounded-xl border border-ak-border bg-ak-surface p-3 md:p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-ak-text truncate">{log.subject}</div>
                    <div className="text-[11px] text-ak-text-dim mt-1">
                      {new Date(log.sentAt).toLocaleDateString("el-GR")}
                      {" · "}
                      {log.sentToAll ? "All confirmed" : "Specific list"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] flex-wrap">
                    <Stat label="Sent" value={log.recipientCount} />
                    <Stat label="Delivered" value={log.deliveredCount} tone="ok" />
                    <Stat label="Failed" value={log.failedCount} tone={log.failedCount > 0 ? "bad" : "dim"} />
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value, tone = "dim" }: { label: string; value: number; tone?: "dim" | "ok" | "bad" }) {
  const color =
    tone === "ok"  ? "text-ak-green" :
    tone === "bad" ? "text-ak-red-text" :
                     "text-ak-text-dim";
  return (
    <div className="text-right">
      <div className={["text-[14px] font-black leading-none", color].join(" ")}>{value}</div>
      <div className="text-[9px] font-black tracking-[0.12em] uppercase text-ak-text-dim mt-0.5">{label}</div>
    </div>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  const result = await getAdminPasskeyLoginProps(params, query);
  if ("notFound" in result) return result;

  const rawEmail         = process.env.ADMIN_ALERT_EMAIL ?? "webmaster@armani-katehano.com";
  const at               = rawEmail.indexOf("@");
  const maskedAdminEmail = at >= 0 ? `***@${rawEmail.slice(at + 1)}` : "***";

  return { props: { ...result.props, maskedAdminEmail } };
}
