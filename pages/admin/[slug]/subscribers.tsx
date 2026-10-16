import { useState, useEffect, useRef, useCallback } from "react";
import type { GetServerSidePropsContext } from "next";
import {
  adminLayout, useAdminSession, apiFetch, asSentence, Btn, F, Segmented, ListRow,
} from "@/client/admin";
import { getAdminPageProps } from "@/server/auth";
import { SubscriberSheet } from "@/client/admin/subscribers/SubscriberSheet";
import {
  STATUS_OPTIONS, isConfirmed, mergeRows, emptyMessage,
  type SubscriberRow, type StatusFilter,
} from "@/client/admin/subscribers/subscriber-list";

const URL_  = "/api/admin/subscribers";
const LIMIT = 50;

type ListResponse = {
  subscribers: SubscriberRow[];
  total:       number;
  page:        number;
  limit:       number;
  hasMore:     boolean;
};

type Sheet = { row: SubscriberRow; error: string | null; openCount: number };

export default function SubscribersPage() {
  const { setToast } = useAdminSession();

  const [rows,        setRows]        = useState<SubscriberRow[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search,      setSearch]      = useState("");
  const [status,      setStatus]      = useState<StatusFilter>("confirmed");
  const [sheet,       setSheet]       = useState<Sheet | null>(null);
  const [pending,     setPending]     = useState<ReadonlySet<string>>(new Set());

  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);
  // Bumped by every first-page load, so a slower response for an older query never lands on a newer one.
  const generation = useRef(0);
  const opens      = useRef(0);
  // A ref, so a removal that fails after the admin opened another sheet sees it and does not replace it.
  const sheetOpen  = useRef(false);

  const fetchPage = useCallback(async (p: number, q: string, st: StatusFilter): Promise<ListResponse> => {
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT), status: st });
    if (q) params.set("search", q);
    const res = await apiFetch(`${URL_}?${params}`);
    if (!res.ok) throw new Error("Fetch failed");
    return res.json();
  }, []);

  const apply = useCallback((data: ListResponse, append: boolean) => {
    setRows(prev => (append ? mergeRows(prev, data.subscribers) : data.subscribers));
    setTotal(data.total);
    setPage(data.page);
    setHasMore(data.hasMore);
  }, []);

  const loadFirst = useCallback(async (q: string, st: StatusFilter) => {
    generation.current += 1;
    const gen = generation.current;
    setLoading(true);
    try {
      const data = await fetchPage(1, q, st);
      if (gen === generation.current) apply(data, false);
    } catch {
      if (gen === generation.current) setToast({ msg: "Failed to load subscribers", type: "error" });
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, [fetchPage, apply, setToast]);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      void loadFirst(search, status);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void loadFirst(search, status), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, status, loadFirst]);

  const loadPage = async (p: number) => {
    const gen  = generation.current;
    const data = await fetchPage(p, search, status);
    if (gen === generation.current) apply(data, true);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadPage(page + 1);
    } catch {
      setToast({ msg: "Failed to load more", type: "error" });
    } finally {
      setLoadingMore(false);
    }
  };

  const open = (row: SubscriberRow, error: string | null = null) => {
    opens.current += 1;
    sheetOpen.current = true;
    setSheet({ row, error, openCount: opens.current });
  };
  const closeSheet = () => { sheetOpen.current = false; setSheet(null); };
  const markPending = (id: string, on: boolean) =>
    setPending(p => { const next = new Set(p); if (on) next.add(id); else next.delete(id); return next; });

  const remove = async () => {
    if (!sheet) return;
    const { row } = sheet;
    closeSheet();
    markPending(row.id, true);
    let failure: { status: number; message: string } | null = null;
    let deleted = 0;
    try {
      const res = await apiFetch(URL_, {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids: [row.id] }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) deleted = Number(body.deleted ?? 0);
      else failure = { status: res.status, message: typeof body.error === "string" ? body.error : "Remove failed" };
    } catch {
      failure = { status: 0, message: "Network error. Check the connection and try again." };
    }
    markPending(row.id, false);

    if (!failure) {
      setRows(prev => prev.filter(r => r.id !== row.id));
      setTotal(t => Math.max(0, t - deleted));
      setToast({ msg: "Subscriber removed.", type: "success" });
      // The removal moved the next page's first row onto this page; re-reading it keeps Load more from skipping that row.
      if (hasMore) {
        void loadPage(page).catch(() =>
          setToast({ msg: "Could not refresh the list. Reload to see every subscriber.", type: "error" }));
      }
    } else if (failure.status !== 401) {
      // A 401 leaves the row in place behind the sign-in overlay.
      if (sheetOpen.current) {
        setToast({ msg: `Could not remove ${row.email}: ${asSentence(failure.message)} Tap it to try again.`, type: "error" });
      } else {
        open(row, failure.message);
      }
    }
  };

  const empty = emptyMessage(status, search);

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] md:text-[28px] font-black text-ak-text">Subscribers</h1>
          <div className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-ak-text-dim">
            {loading ? "Loading..." : `${total} total`}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API route that streams a CSV download; <Link /> does client-side nav and would swallow the response */}
        <a
          href="/api/admin/subscribers/export"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-ak-border bg-ak-surface px-4 text-[12px] font-black uppercase tracking-[0.12em] text-ak-text no-underline"
        >
          Export CSV
        </a>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:max-w-[320px] sm:flex-1">
          <F label="SEARCH" type="search" value={search} onChange={setSearch} placeholder="Search email" />
        </div>
        <Segmented label="Filter by status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>

      {loading ? (
        <SubscriberSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState title={empty.title} hint={empty.hint} />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {rows.map(r => (
              <li key={r.id}>
                <ListRow onClick={() => open(r)} pending={pending.has(r.id)}>
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={["h-2.5 w-2.5 shrink-0 rounded-full", isConfirmed(r) ? "bg-ak-green" : "bg-ak-gold"].join(" ")}
                    />
                    <span className="sr-only">{isConfirmed(r) ? "Confirmed" : "Pending"}</span>
                    <span className="truncate font-mono text-[14px] text-ak-text">{r.email}</span>
                  </div>
                </ListRow>
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="mt-5 flex justify-center">
              <Btn variant="ghost" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? "LOADING..." : "LOAD MORE"}
              </Btn>
            </div>
          )}
        </>
      )}

      <SubscriberSheet
        open={sheet !== null}
        resetKey={sheet?.openCount}
        row={sheet?.row ?? null}
        error={sheet?.error ?? null}
        onRemove={() => void remove()}
        onClose={() => {
          if (!sheet) return;
          closeSheet();
        }}
      />
    </>
  );
}

SubscribersPage.getLayout = adminLayout("Subscribers");

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
      <div className="mb-1 text-[15px] font-black text-ak-text">{title}</div>
      <div className="text-[12px] text-ak-text-dim">{hint}</div>
    </div>
  );
}

function SubscriberSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
        <li key={i} className="h-[56px] animate-pulse rounded-xl border border-ak-border bg-ak-surface" />
      ))}
    </ul>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return getAdminPageProps(ctx);
}
