import React, { useState } from "react";
import Link from "next/link";

export function SubscribeForm() {
  const [email,  setEmail]  = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("done");
      } else {
        const d = await res.json().catch(() => ({}));
        setErrMsg(d.error ?? "Something went wrong.");
        setStatus("error");
      }
    } catch {
      setErrMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="rounded-[14px] py-5 px-[22px] border border-ak-border bg-ak-surface mb-6">
      <div className="mb-1.5">
        <div className="text-[13px] font-black text-ak-text tracking-[0.04em]">Game emails</div>
        <div className="text-[11px] text-ak-text-dim mt-0.5">Roster announcements before games and recaps after</div>
      </div>
      {status === "done" ? (
        <div className="flex items-center gap-2 mt-3 py-[10px] px-[14px] rounded-lg bg-[#4caf7d14] border border-[#4caf7d35]">
          <span className="text-base">✓</span>
          <div className="text-[13px] text-ak-green font-bold">Check your email and click the confirmation link to complete your subscription.</div>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="flex gap-2 flex-wrap mt-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 min-w-[200px] py-2 px-3 text-[13px] rounded-lg border border-ak-border2 bg-ak-base text-ak-text outline-none"
            />
            <button
              type="submit"
              disabled={status === "loading" || !email}
              className={`py-2 px-[18px] rounded-lg border-0 bg-ak-red text-ak-text text-[11px] font-black tracking-[0.1em] uppercase whitespace-nowrap ${status === "loading" || !email ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
              {status === "loading" ? "Subscribing…" : "Notify me"}
            </button>
          </form>
          {status === "error" && <div className="mt-[7px] text-xs text-ak-red-text">{errMsg}</div>}
          <div className="mt-2 text-[10px] text-ak-text-dim space-y-0.5">
            <div>Used only for Armani Katehano game emails. Never shared. Deleted on unsubscribe. Unconfirmed addresses removed after 24 hours.</div>
            <div><Link href="/privacy" className="underline text-ak-text-dim hover:text-ak-text-sub transition-colors duration-150">Privacy notice</Link></div>
          </div>
        </>
      )}
    </div>
  );
}
