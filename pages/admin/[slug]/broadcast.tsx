import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  adminLayout, useAdminSession, Spinner, Btn, F, TextArea, Segmented, apiFetch,
} from "@/client/admin";
import type { GetServerSidePropsContext } from "next";
import { getAdminPageProps } from "@/server/auth";

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

type View = "write" | "preview";

const VIEWS: ReadonlyArray<{ value: View; label: string }> = [
  { value: "write",   label: "Write" },
  { value: "preview", label: "Preview" },
];

const RECIPIENT_MODES: ReadonlyArray<{ value: "all" | "specific"; label: string }> = [
  { value: "all",      label: "All confirmed" },
  { value: "specific", label: "Specific" },
];

export default function BroadcastPage({ maskedAdminEmail }: { maskedAdminEmail: string }) {
  const { setToast } = useAdminSession();

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
  const [view, setView] = useState<View>("write");
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null);
  const [logs,           setLogs]           = useState<BroadcastLogRow[]>([]);

  const [sanitized, setSanitized] = useState<{ src: string; html: string } | null>(null);
  const sanitizedHtml = sanitized?.src === renderedHtml ? sanitized.html : "";

  const currentKey     = subject + "|" + body;
  const previewCurrent = previewKey === currentKey && renderedHtml !== null;
  const resolveCurrent = resolvedForText === specificEmails && resolveResult !== null;

  const canReview =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    previewCurrent &&
    (recipientMode === "all" || (recipientMode === "specific" && resolveCurrent && resolveResult!.matched > 0));

  const fetchHistory = useCallback(() =>
    apiFetch("/api/admin/broadcast?limit=20")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setLogs(data.logs ?? []); })
      .catch(() => {}),
  []);

  const fetchCount = useCallback(() =>
    apiFetch("/api/admin/subscribers?status=confirmed&limit=1")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setConfirmedCount(data.total ?? 0); })
      .catch(() => {}),
  []);

  useEffect(() => {
    void Promise.all([fetchHistory(), fetchCount()]);
  }, [fetchHistory, fetchCount]);

  useEffect(() => {
    if (!renderedHtml) return;
    import("dompurify").then(({ default: DOMPurify }) => {
      setSanitized({ src: renderedHtml, html: DOMPurify.sanitize(renderedHtml, {
        ALLOWED_TAGS: ["p","h1","h2","h3","h4","h5","h6","ul","ol","li","a","strong","em","code","pre","blockquote","br","hr"],
        ALLOWED_ATTR: ["href"],
      }) });
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
      setView("preview");
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
      setView("write");
      setMode("compose");
      void fetchHistory();
    } catch (err: any) {
      setToast({ msg: err.message ?? "Send failed", type: "error" });
      setMode("compose");
    }
  };

  const recipientLabel = recipientMode === "all"
    ? `All confirmed subscribers${confirmedCount !== null ? ` (${confirmedCount})` : ""}`
    : resolveResult
      ? `${resolveResult.matched} specific subscriber${resolveResult.matched !== 1 ? "s" : ""}`
      : "Specific subscribers";

  return (
    <>
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
              <div className="mb-4">
                <Segmented label="Composer view" options={VIEWS} value={view} onChange={setView} />
              </div>

              {view === "write" ? (
                <div className="flex flex-col gap-5">
                  <div>
                    <F label="SUBJECT" value={subject} onChange={handleSubjectChange} maxLength={200} placeholder="Email subject" />
                    {subject.length >= 180 && (
                      <div className={["mt-1 text-[11px]", subject.length >= 200 ? "text-ak-red-text" : "text-ak-text-dim"].join(" ")}>
                        {subject.length}/200
                      </div>
                    )}
                  </div>

                  <div>
                    <TextArea
                      label="BODY (MARKDOWN)"
                      value={body}
                      onChange={handleBodyChange}
                      rows={10}
                      maxLength={50_000}
                      mono
                      placeholder="Write your message in Markdown"
                    />
                    {body.length >= 48_000 && (
                      <div className={["mt-1 text-[11px]", body.length >= 50_000 ? "text-ak-red-text" : "text-ak-text-dim"].join(" ")}>
                        {body.length.toLocaleString()}/50,000
                      </div>
                    )}
                  </div>

                  <div>
                    <FieldLabel>Recipients</FieldLabel>
                    <div className="mb-3">
                      <Segmented
                        label="Recipients"
                        options={RECIPIENT_MODES}
                        value={recipientMode}
                        onChange={m => { setRecipientMode(m); setResolveResult(null); setResolvedForText(null); }}
                      />
                    </div>

                    {recipientMode === "all" && confirmedCount !== null && (
                      <p className="text-[12px] text-ak-text-dim">
                        Will send to <strong className="text-ak-text">{confirmedCount}</strong> confirmed subscriber{confirmedCount !== 1 ? "s" : ""}.
                        Actual count may differ slightly at send time.
                      </p>
                    )}

                    {recipientMode === "specific" && (
                      <div>
                        <TextArea
                          label="EMAILS"
                          value={specificEmails}
                          onChange={handleSpecificEmailsChange}
                          rows={4}
                          mono
                          placeholder="One email per line, or comma-separated"
                        />
                        <div className="mt-2">
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={handleCheckRecipients}
                            disabled={resolving || !specificEmails.trim()}
                          >
                            {resolving ? "CHECKING..." : "CHECK RECIPIENTS"}
                          </Btn>
                        </div>
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
                </div>
              ) : (
                <div>
                  <div className="mb-3 text-[14px] font-bold text-ak-text">{subject.trim() || "No subject yet"}</div>
                  {previewCurrent && sanitizedHtml ? (
                    <PreviewBody html={sanitizedHtml} />
                  ) : (
                    <p className="rounded-[10px] border border-dashed border-ak-border px-4 py-6 text-center text-[13px] text-ak-text-dim">
                      No preview of this text yet. Send one to see the email as subscribers will get it.
                    </p>
                  )}
                  <div className="mt-4">
                    <Btn variant="ghost" onClick={handleSendPreview} disabled={sendingPreview || !subject.trim() || !body.trim()}>
                      {sendingPreview ? "SENDING PREVIEW..." : `SEND PREVIEW TO ${maskedAdminEmail.toUpperCase()}`}
                    </Btn>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ak-border pt-4">
                <Btn variant="primary" onClick={() => setMode("confirming")} disabled={!canReview}>
                  REVIEW &amp; SEND
                </Btn>
                {!previewCurrent && subject.trim() && body.trim() && (
                  <p className="text-[11px] text-ak-text-dim">Send a preview from the Preview tab to enable sending.</p>
                )}
              </div>
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
                  <PreviewBody html={sanitizedHtml} />
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
    </>
  );
}

BroadcastPage.getLayout = adminLayout("Broadcast");

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
    <div className="mb-[6px] text-[10px] font-black uppercase tracking-[0.15em] text-ak-text-dim">
      {children}
    </div>
  );
}

function PreviewBody({ html }: { html: string }) {
  return (
    <div
      className="rounded-[10px] border border-ak-border bg-white p-5 text-[14px] text-black prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
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

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const result = await getAdminPageProps(ctx);
  if ("notFound" in result) return result;

  const rawEmail         = process.env.ADMIN_ALERT_EMAIL ?? "webmaster@armani-katehano.com";
  const at               = rawEmail.indexOf("@");
  const maskedAdminEmail = at >= 0 ? `***@${rawEmail.slice(at + 1)}` : "***";

  return { props: { ...result.props, maskedAdminEmail } };
}
