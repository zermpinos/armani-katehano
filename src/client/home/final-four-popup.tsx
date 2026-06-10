import { useState, useEffect, useRef } from "react";
import Image from "next/image";

type NextPlayoffGame = {
  opponent:     string;
  scheduledFor: string;
  location:     string;
  round:        string;
  notes:        string | null;
};

function roundLabel(round: string): string {
  if (round === "final")        return "FINAL";
  if (round === "semifinal")    return "SEMIFINAL";
  if (round === "quarterfinal") return "QUARTERFINAL";
  return round.toUpperCase();
}

function formatGameDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  }) + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const DEFAULT_KEY = "ak_f4_dismissed";

const HEADLINES: Record<string, { kicker: string; main: string }> = {
  semifinal: { kicker: "WE'RE IN THE", main: "FINAL FOUR" },
  final:     { kicker: "WE'RE IN THE", main: "FINAL"      },
};

export function FinalFourPopup({
  nextGame,
  dismissKey = DEFAULT_KEY,
  round = "semifinal",
}: {
  nextGame:    NextPlayoffGame | null;
  dismissKey?: string;
  round?:      "semifinal" | "final";
}) {
  const [open,    setOpen]    = useState(false);
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!localStorage.getItem(dismissKey)) setOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [open]);

  function dismiss() {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      localStorage.setItem(dismissKey, "1");
    }, 240);
  }

  if (!open) return null;

  const headline = HEADLINES[round] ?? HEADLINES.semifinal;
  const today = new Date();
  const dateKicker = `${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}.${today.getFullYear()}`;

  return (
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center p-4 ${closing ? "ak-backdrop-exit" : "ak-backdrop-enter"}`}
      style={{ backdropFilter: "blur(16px) saturate(150%)", background: "rgba(0,0,0,0.78)" }}
      onClick={dismiss}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 20%, rgba(0,0,0,0.52) 100%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none animate-ak-spotlight"
        style={{ background: "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(139,26,26,0.5) 0%, transparent 68%)" }}
      />

      {/* Drifting background blobs */}
      <div className="absolute top-[8%] left-[12%] w-[600px] h-[600px] rounded-full animate-ak-blob-1 pointer-events-none"
           style={{ background: "radial-gradient(circle, #8b1a1a55 0%, transparent 70%)", filter: "blur(88px)" }} />
      <div className="absolute bottom-[12%] right-[8%] w-[460px] h-[460px] rounded-full animate-ak-blob-2 pointer-events-none"
           style={{ background: "radial-gradient(circle, #c0392b40 0%, transparent 70%)", filter: "blur(72px)" }} />
      <div className="absolute top-[45%] right-[22%] w-[520px] h-[520px] rounded-full animate-ak-blob-3 pointer-events-none"
           style={{ background: "radial-gradient(circle, #8b1a1a35 0%, transparent 70%)", filter: "blur(80px)" }} />

      <div
        className="absolute top-0 bottom-0 w-[260px] pointer-events-none animate-ak-sweep"
        style={{ left: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.032) 50%, transparent 100%)" }}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Final Four announcement"
        className={`relative bg-ak-surface border border-ak-border2 rounded-2xl max-w-[440px] w-full overflow-hidden ${closing ? "ak-modal-exit" : "ak-modal-enter"}`}
        style={{
          boxShadow: "0 32px 80px rgba(0,0,0,0.72), 0 0 0 1px rgba(192,57,43,0.22), inset 0 1px 0 rgba(255,255,255,0.05)",
          ...(closing ? {} : { animationDelay: "0.08s" }),
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top red accent bar */}
        <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, #8b1a1a 0%, #c0392b 50%, #8b1a1a 100%)" }} />

        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{ height: "240px", background: "radial-gradient(ellipse 85% 200px at 50% -10px, rgba(192,57,43,0.22) 0%, transparent 70%)" }}
        />

        <div
          className="absolute rounded-full pointer-events-none animate-ak-rot-ccw"
          style={{ top: "-55%", left: "-25%", width: "150%", height: "150%", background: "radial-gradient(ellipse at 62% 38%, rgba(139,26,26,0.13) 0%, transparent 55%)" }}
        />

        <div className="absolute inset-0 ak-hero-texture pointer-events-none opacity-[0.04]" />

        <div className="relative px-6 pt-6 pb-5">
          {/* Close button */}
          <button
            aria-label="Close announcement"
            onClick={dismiss}
            className="absolute top-5 right-5 w-7 h-7 flex items-center justify-center rounded-full bg-ak-surface2 border border-ak-border text-ak-text-dim text-[13px] font-black leading-none cursor-pointer hover:text-ak-text hover:border-ak-border2 transition-colors"
          >
            ✕
          </button>

          {/* Logo */}
          <div className="flex justify-center mb-4">
            <Image
              src="/logohighres.png"
              alt="Armani Katehano"
              width={3760}
              height={2748}
              className="h-[64px] w-auto object-contain"
              priority
            />
          </div>

          {/* Date kicker */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="inline-block w-[7px] h-[7px] rounded-full bg-ak-red-bright animate-ak-pulse flex-shrink-0" />
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-ak-text-dim">{dateKicker}</span>
          </div>

          {/* Separator between kicker and headline */}
          <div className="border-t border-ak-border opacity-50 mb-5 mx-2" />

          {/* Headline */}
          <div className="text-center mb-7">
            <div className="text-[11px] font-black tracking-[0.28em] uppercase mb-[5px]" style={{ color: "rgba(236,102,102,0.75)" }}>
              {headline.kicker}
            </div>
            <div className="ak-shimmer-text text-[clamp(40px,11vw,56px)] font-black leading-none tracking-[-0.02em] uppercase">
              {headline.main}
            </div>
          </div>

          {/* Primary CTA */}
          <button
            onClick={dismiss}
            className="w-full py-[13px] px-5 rounded-xl text-ak-text text-[13px] font-black tracking-[0.14em] uppercase cursor-pointer border-0 mb-3 transition-all active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #c0392b 0%, #8b1a1a 100%)",
              boxShadow: "0 4px 18px rgba(192,57,43,0.38), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            {"I'LL BE THERE"}
          </button>

          {/* Secondary link */}
          <button
            onClick={dismiss}
            className="w-full py-2 text-[12px] font-bold text-ak-text-dim bg-transparent border-0 cursor-pointer hover:text-ak-text-sub transition-colors"
          >
            Back to site
          </button>
        </div>

        {/* Next game strip */}
        {nextGame && (
          <div className="border-t border-ak-border bg-ak-surface2 px-6 py-4">
            <div className="mb-2">
              <span
                className="inline-flex items-center px-2 py-[3px] rounded text-[10px] font-black tracking-[0.18em] uppercase"
                style={{ background: "rgba(139,26,26,0.2)", border: "1px solid rgba(192,57,43,0.28)", color: "#ec6666" }}
              >
                {roundLabel(nextGame.round)}
              </span>
            </div>
            <div className="text-[16px] font-black text-ak-text leading-snug mb-[5px]">
              <span style={{ color: nextGame.location === "home" ? "#ec6666" : undefined }}
                    className={nextGame.location === "away" ? "text-ak-text-dim" : ""}>
                {nextGame.location === "home" ? "vs" : "@"}
              </span>
              {" "}{nextGame.opponent}
            </div>
            <div className="text-[12px] text-ak-text-sub">
              {formatGameDateTime(nextGame.scheduledFor)}
            </div>
            {nextGame.notes && (
              <div className="text-[11px] text-ak-text-dim mt-1.5 flex items-center gap-1.5">
                <svg width="11" height="13" viewBox="0 0 11 13" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 opacity-60">
                  <path d="M5.5 0C3.015 0 1 2.015 1 4.5c0 3.375 4.5 8.5 4.5 8.5s4.5-5.125 4.5-8.5C10 2.015 7.985 0 5.5 0zm0 6.125A1.625 1.625 0 1 1 5.5 2.875a1.625 1.625 0 0 1 0 3.25z" fill="currentColor"/>
                </svg>
                {nextGame.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
