import Link from "next/link";
import { fmtDate } from "@/domain/shared/format";
import { recordText, type HeadToHead } from "@/domain/stats/head-to-head";

const RESULT_CLASS: ReadonlyArray<[string, string]> = [["W", "text-ak-green"], ["L", "text-ak-red-text"]];

export function HeadToHeadBlock({ h2h, title, emptyText, showAllLink }: {
  h2h:         HeadToHead;
  title:       string;
  emptyText:   string;
  showAllLink: boolean;
}) {
  const none = h2h.meetings.length === 0;
  return (
    <section aria-label={title} className="mt-3 border-t border-ak-border pt-3">
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-ak-text-dim">{title}</div>
      {none ? (
        <div className="mt-1 text-[12px] text-ak-text-sub">{emptyText}</div>
      ) : (
        <>
          <div className="mt-1 text-[13px] font-bold text-ak-text">{`Record: ${recordText(h2h)}`}</div>
          <ul className="mt-1 flex flex-col gap-0.5">
            {h2h.meetings.map(m => (
              <li key={m.id} className="text-[12px] text-ak-text-sub">
                <Link href={`/games/${m.id}`} className="hover:text-ak-text">
                  {`${fmtDate(m.date)} · ${m.competition} ${m.season} · `}
                  <span className={`font-bold ${RESULT_CLASS.find(([r]) => r === m.result)?.[1] ?? "text-ak-text"}`}>{m.result}</span>
                  {` ${m.score}`}
                </Link>
              </li>
            ))}
          </ul>
          {showAllLink && h2h.slug !== "" && (
            <Link href={`/opponents/${h2h.slug}`} className="mt-1 inline-block text-[11px] font-black uppercase tracking-[0.1em] text-ak-red-text">
              All meetings
            </Link>
          )}
        </>
      )}
    </section>
  );
}
