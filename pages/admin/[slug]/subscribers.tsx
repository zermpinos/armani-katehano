import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import {
  AdminLayout, Spinner, LoginForm, Btn, useAdminAuth, apiFetch,
} from "@/client/admin";
import { validateAdminSlug } from "@/server/auth";

type SubscriberRow = {
  id: string;
  email: string;
  createdAt: string;
  confirmedAt: string | null;
};

type ListResponse = {
  subscribers: SubscriberRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

const LIMIT = 50;

export default function SubscribersPage({ validSlug }: { validSlug: boolean }) {
  const router = useRouter();
  const slug   = router.query.slug || validSlug;
  const { authed, loading: authLoading, loginError, handleLogin, handleLogout } =
    useAdminAuth(slug);

  const [rows,        setRows]        = useState<SubscriberRow[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search,      setSearch]      = useState("");
  const [status,      setStatus]      = useState<"confirmed" | "unconfirmed" | "all">("confirmed");
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
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
  }, [search, status, authed, slug]);

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
    setSelected(
      selected.size === rows.length ? new Set() : new Set(rows.map(r => r.id))
    );

  const handleDelete = async () => {
    if (!window.confirm(
      `Delete ${selected.size} subscriber${selected.size !== 1 ? "s" : ""}? This cannot be undone.`
    )) return;

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
      setToast({ msg: `Deleted ${deleted} subscriber${deleted !== 1 ? "s" : ""}` });
    } catch {
      setSelected(new Set());
      setToast({ msg: "Delete failed", type: "error" });
    } finally {
      setDeleting(false);
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

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <AdminLayout slug={slug} title="Subscribers" toast={toast} setToast={setToast} onLogout={handleLogout}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim uppercase mb-[2px]">
            Subscribers
          </div>
          <div className="text-[22px] font-black text-ak-text">
            {loading ? "—" : total}
          </div>
        </div>
        <a
          href="/api/admin/subscribers/export"
          className="py-[9px] px-[18px] text-[13px] font-black tracking-[0.12em] rounded-lg border border-ak-border bg-ak-surface text-ak-text font-sans no-underline"
        >
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search email…"
          className="py-[7px] px-[10px] text-xs rounded-[7px] border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none w-[240px]"
        />
        <div className="flex rounded-[7px] border border-ak-border2 overflow-hidden">
          {(["confirmed", "unconfirmed", "all"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={[
                "px-3 py-[7px] text-[11px] font-black tracking-[0.1em] uppercase font-sans border-0 cursor-pointer",
                status === s ? "bg-ak-surface text-ak-text" : "bg-ak-base text-ak-text-dim",
              ].join(" ")}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 py-[9px] px-[14px] rounded-[9px] border border-ak-border bg-ak-surface">
          <span className="text-[12px] font-bold text-ak-text-dim">
            {selected.size} selected
          </span>
          <Btn variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Btn>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-[60px]"><Spinner /></div>
      ) : rows.length === 0 ? (
        <div className="text-[13px] text-ak-text-dim py-8 text-center">No subscribers found.</div>
      ) : (
        <div className="border border-ak-border rounded-[10px] overflow-hidden mb-5">
          {/* Table header */}
          <div className="flex items-center py-[8px] px-[14px] bg-ak-surface2 border-b border-ak-border">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="mr-3 cursor-pointer"
            />
            <span className="flex-1 text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase">
              Email
            </span>
            <span className="w-[100px] text-right text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase">
              Confirmed
            </span>
            <span className="w-[100px] text-right text-[9px] font-black tracking-[0.15em] text-ak-text-dim uppercase ml-4">
              Joined
            </span>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.id}
              className={[
                "flex items-center py-[9px] px-[14px]",
                i % 2 === 0 ? "bg-ak-surface" : "bg-ak-surface2",
                i === 0 ? "" : "border-t border-ak-border",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggleRow(r.id)}
                className="mr-3 cursor-pointer"
              />
              <span className="flex-1 text-[13px] text-ak-text font-mono">{r.email}</span>
              <span className="w-[100px] text-right text-[11px] text-ak-text-dim whitespace-nowrap">
                {r.confirmedAt?.slice(0, 10) ?? "—"}
              </span>
              <span className="w-[100px] text-right text-[11px] text-ak-text-dim whitespace-nowrap ml-4">
                {r.createdAt?.slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Btn variant="ghost" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Btn>
        </div>
      )}
    </AdminLayout>
  );
}

export async function getServerSideProps({ params }: { params: { slug: string } }) {
  const validSlug = await validateAdminSlug(params.slug);
  if (!validSlug) return { notFound: true };
  return { props: { validSlug } };
}
