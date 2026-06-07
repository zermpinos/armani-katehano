import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import {
  AdminLayout, Spinner, PasskeyLoginForm, Btn, Confirm, useAdminAuth, apiFetch,
} from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";

const LIMIT = 50;

type SubscriberRow = {
  id:          string;
  email:       string;
  createdAt:   string;
  confirmedAt: string | null;
};

type ListResponse = {
  subscribers: SubscriberRow[];
  total:       number;
  page:        number;
  limit:       number;
  hasMore:     boolean;
};

const STATUS_OPTIONS = ["confirmed", "unconfirmed", "all"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

const STATUS_LABEL: Record<StatusFilter, string> = {
  confirmed:   "Confirmed",
  unconfirmed: "Pending",
  all:         "All",
};

export default function SubscribersPage({
  validSlug, showFallback, noPasskeys,
}: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [rows,        setRows]        = useState<SubscriberRow[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search,      setSearch]      = useState("");
  const [status,      setStatus]      = useState<StatusFilter>("confirmed");
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [askDelete,   setAskDelete]   = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [toast,       setToast]       = useState<{ msg: string; type?: string } | null>(null);

  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  const fetchPage = useCallback(async (
    p: number, q: string, st: string, append: boolean,
  ) => {
    const params = new URLSearchParams({
      page: String(p), limit: String(LIMIT), status: st,
    });
    if (q) params.set("search", q);
    const res = await fetch(`/api/admin/subscribers?${params}`);
    if (!res.ok) throw new Error("Fetch failed");
    const data: ListResponse = await res.json();
    setRows(prev => append ? [...prev, ...data.subscribers] : data.subscribers);
    setTotal(data.total);
    setPage(data.page);
    setHasMore(data.hasMore);
    if (!append) setSelected(new Set());
  }, []);

  const loadFirst = useCallback(async (q: string, st: string) => {
    setLoading(true);
    try {
      await fetchPage(1, q, st, false);
    } catch {
      setToast({ msg: "Failed to load subscribers", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    if (!authed || !slug) return;
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      void loadFirst(search, status);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void loadFirst(search, status), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, status, authed, slug, loadFirst]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await fetchPage(page + 1, search, status, true);
    } catch {
      setToast({ msg: "Failed to load more", type: "error" });
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleRow = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(selected.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch("/api/admin/subscribers", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error();
      const { deleted } = await res.json();
      setRows(prev => prev.filter(r => !selected.has(r.id)));
      setTotal(prev => prev - deleted);
      setSelected(new Set());
      setToast({ msg: `Deleted ${deleted} subscriber${deleted !== 1 ? "s" : ""}`, type: "success" });
    } catch {
      setSelected(new Set());
      setToast({ msg: "Delete failed", type: "error" });
    } finally {
      setDeleting(false);
      setAskDelete(false);
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

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <AdminLayout slug={slug} title="Subscribers" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <header className="mb-5 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] md:text-[28px] font-black text-ak-text">Subscribers</h1>
          <div className="text-[11px] font-black tracking-[0.12em] uppercase text-ak-text-dim mt-1">
            {loading ? "Loading..." : `${total} total`}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API route that streams a CSV download; <Link /> does client-side nav and would swallow the response */}
        <a
          href="/api/admin/subscribers/export"
          className="inline-flex items-center py-[9px] px-[16px] text-[12px] font-black tracking-[0.12em] uppercase rounded-lg border border-ak-border bg-ak-surface text-ak-text no-underline"
        >
          Export CSV
        </a>
      </header>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search email..."
          className="flex-1 sm:max-w-[280px] py-[8px] px-[12px] text-[13px] rounded-[7px] border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none"
        />
        <div role="tablist" aria-label="Filter by status" className="flex rounded-[7px] border border-ak-border2 overflow-hidden self-start">
          {STATUS_OPTIONS.map(s => {
            const active = status === s;
            return (
              <button
                key={s}
                role="tab"
                aria-selected={active}
                onClick={() => setStatus(s)}
                className={[
                  "px-3 py-[8px] text-[11px] font-black tracking-[0.1em] uppercase font-sans border-0 cursor-pointer",
                  active ? "bg-ak-surface text-ak-text" : "bg-ak-base text-ak-text-dim",
                ].join(" ")}
              >
                {Reflect.get(STATUS_LABEL, s) as string}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <SubscriberSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState search={search} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-2 px-1">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="cursor-pointer"
              />
              <span className="text-[11px] font-black tracking-[0.1em] uppercase text-ak-text-dim">
                {selected.size > 0 ? `${selected.size} selected` : "Select all"}
              </span>
            </label>
            {selected.size > 0 && (
              <Btn variant="danger" size="sm" onClick={() => setAskDelete(true)} disabled={deleting}>
                {deleting ? "DELETING..." : `DELETE ${selected.size}`}
              </Btn>
            )}
          </div>
          <ul className="flex flex-col gap-1.5">
            {rows.map(r => {
              const checked = selected.has(r.id);
              return (
                <li key={r.id}>
                  <label
                    className={[
                      "flex items-center gap-3 py-[10px] px-[12px] md:px-[14px] rounded-[9px] border cursor-pointer",
                      checked
                        ? "border-[#8b1a1a55] bg-[#8b1a1a10]"
                        : "border-ak-border bg-ak-surface",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRow(r.id)}
                      className="cursor-pointer shrink-0"
                    />
                    <div className="min-w-0 flex-1 md:flex md:items-center md:gap-4">
                      <span className="block md:flex-1 text-[13px] text-ak-text font-mono truncate">
                        {r.email}
                      </span>
                      <div className="mt-1 md:mt-0 flex flex-wrap gap-x-4 gap-y-0 text-[11px] text-ak-text-dim">
                        <span>
                          <span className="md:hidden text-ak-text-dim">Confirmed: </span>
                          <span className="hidden md:inline text-ak-text-dim mr-1">Confirmed</span>
                          {r.confirmedAt?.slice(0, 10) ?? "-"}
                        </span>
                        <span>
                          <span className="md:hidden text-ak-text-dim">Joined: </span>
                          <span className="hidden md:inline text-ak-text-dim mr-1">Joined</span>
                          {r.createdAt.slice(0, 10)}
                        </span>
                      </div>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <div className="flex justify-center mt-5">
              <Btn variant="ghost" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? "LOADING..." : "LOAD MORE"}
              </Btn>
            </div>
          )}
        </>
      )}

      {askDelete && (
        <Confirm
          msg={`Delete ${selected.size} subscriber${selected.size !== 1 ? "s" : ""}? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setAskDelete(false)}
        />
      )}
    </AdminLayout>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
      <div className="text-[15px] font-black text-ak-text mb-1">
        {search ? "No matches" : "No subscribers yet"}
      </div>
      <div className="text-[12px] text-ak-text-dim">
        {search
          ? "Try a different search or clear the filters."
          : "Subscribers appear here once visitors sign up from the public site."}
      </div>
    </div>
  );
}

function SubscriberSkeleton() {
  return (
    <ul className="flex flex-col gap-1.5">
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
        <li key={i} className="rounded-[9px] border border-ak-border bg-ak-surface h-[54px] animate-pulse" />
      ))}
    </ul>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
