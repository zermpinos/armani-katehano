import Link from "next/link";
import { useId, type ReactNode } from "react";
import { fmtDate } from "@/domain/shared/format";
import { meetingCount, recordText, type HeadToHead } from "@/domain/stats/head-to-head";

const EMPTY_TEXT = "First meeting between the teams.";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ak-red-text";
const LINK_TEXT = "text-[11px] font-black uppercase tracking-[0.1em] text-ak-red-text";

// Letters lighter than the games list's badges, which miss WCAG AA at this size.
const BADGES: ReadonlyArray<{ result: string; cls: string; word: string }> = [
  { result: "W", cls: "border-[#4caf7d40] bg-[#4caf7d20] text-[#5ab886]", word: "Win" },
  { result: "L", cls: "border-[#8b1a1a60] bg-[#8b1a1a25] text-[#ef6f6f]", word: "Loss" },
  { result: "T", cls: "border-ak-border2 bg-ak-surface text-ak-text-sub", word: "Tie" },
];

const countText = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function recordWords(h: HeadToHead): string {
  const parts = [countText(h.wins, "win", "wins"), countText(h.losses, "loss", "losses")];
  if (h.ties) parts.push(countText(h.ties, "tie", "ties"));
  return parts.join(", ");
}

function RecordValue({ h2h }: { h2h: HeadToHead }) {
  return (
    <>
      <span aria-hidden="true" className="tabular-nums">{recordText(h2h)}</span>
      <span className="sr-only">{recordWords(h2h)}</span>
    </>
  );
}

function ResultBadge({ result, size = "sm" }: { result: string; size?: "sm" | "md" }) {
  const badge = BADGES.find(b => b.result === result);
  return (
    <span className={[
      "inline-flex shrink-0 items-center justify-center rounded-full border font-black",
      size === "md" ? "h-[22px] w-[22px] text-[11px]" : "h-5 w-5 text-[10px]",
      badge?.cls ?? "border-ak-border2 text-ak-text-sub",
    ].join(" ")}>
      <span aria-hidden="true">{result}</span><span className="sr-only">{badge?.word ?? result}</span>
    </span>
  );
}

// Safari drops list semantics once the list style is removed, hence role="list".
function FormStrip({ form, behind, size = "sm" }: { form: string[]; behind: "surface" | "surface2"; size?: "sm" | "md" }) {
  const offset = behind === "surface" ? "ring-offset-ak-surface" : "ring-offset-ak-surface2";
  return (
    <ol role="list" aria-label={`Last ${form.length} results, newest first`} className="flex items-center justify-center gap-1">
      {form.map((result, i) => (
        <li key={i} className={i === 0 ? `flex rounded-full ring-1 ring-ak-text-sub ring-offset-2 ${offset}` : "flex"}>
          <ResultBadge result={result} size={size} />
        </li>
      ))}
    </ol>
  );
}

function CardTile({ label, sub, wide, children }: { label: string; sub: string; wide: boolean; children: ReactNode }) {
  return (
    <div className={`rounded-[10px] border border-ak-border2 px-2 py-2.5 text-center${wide ? " col-span-2" : ""}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-ak-text-dim">{label}</div>
      <div className="mt-1 flex min-h-[30px] items-center justify-center text-[24px] font-black leading-none text-ak-text">{children}</div>
      <div className="mt-1 text-[11px] text-ak-text-sub">{sub}</div>
    </div>
  );
}

export function HeadToHeadBlock({ h2h, title, linkFirstMeeting = false }: {
  h2h:               HeadToHead;
  title:             string;
  linkFirstMeeting?: boolean;
}) {
  const titleId = useId();
  const total = meetingCount(h2h);
  const showLink = h2h.slug !== "" && (total > 0 || linkFirstMeeting);
  return (
    <section aria-labelledby={titleId} className="mt-4 rounded-[10px] border border-ak-border bg-ak-surface2 px-3 pb-2">
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <h3 id={titleId} className="text-[12px] font-black uppercase tracking-[0.12em] text-ak-text">{title}</h3>
        {showLink && (
          <Link href={`/opponents/${h2h.slug}`} className={`-mr-1 inline-flex min-h-[44px] items-center px-1 ${LINK_TEXT} ${FOCUS}`}>
            All meetings ›
          </Link>
        )}
      </div>
      {total === 0 ? (
        <p className="pb-2 text-[13px] text-ak-text-sub">{EMPTY_TEXT}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <CardTile label="Record" sub={countText(total, "meeting", "meetings")} wide={total < 2}>
              <RecordValue h2h={h2h} />
            </CardTile>
            {total >= 2 && (
              <CardTile label={`Last ${h2h.form.length}`} sub="newest first" wide={false}>
                <FormStrip form={h2h.form} behind="surface2" />
              </CardTile>
            )}
          </div>
          <ul role="list" className="mt-2">
            {h2h.meetings.map(m => (
              <li key={m.id} className="border-t border-ak-border2 first:border-t-0">
                <Link href={`/games/${m.id}`} className={`grid min-h-[44px] grid-cols-[82px_1fr_auto_12px] items-center gap-x-2 text-[12px] tabular-nums ${FOCUS}`}>
                  <span className="text-ak-text-sub">{fmtDate(m.date)}</span>{" "}
                  <span className="truncate text-ak-text-sub">{m.competition}</span>{" "}
                  <span className="flex items-center gap-1.5 text-[13px] font-black text-ak-text">
                    <ResultBadge result={m.result} />{" "}{m.score}
                  </span>
                  <span aria-hidden="true" className="text-ak-text-dim">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function HeadToHeadLine({ h2h }: { h2h: HeadToHead }) {
  const total = meetingCount(h2h);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]">
      <span className="sr-only">Head-to-head:</span>
      {total === 0 ? (
        <span className="text-[12px] text-ak-text-sub">{EMPTY_TEXT}</span>
      ) : (
        <>
          <span className="font-black text-ak-text"><RecordValue h2h={h2h} /></span>
          {total >= 2 && <FormStrip form={h2h.form} behind="surface2" />}
          {h2h.slug !== "" && (
            <Link href={`/opponents/${h2h.slug}`} className={`inline-flex min-h-[24px] items-center ${LINK_TEXT} ${FOCUS}`}>
              All meetings ›
            </Link>
          )}
        </>
      )}
    </div>
  );
}
