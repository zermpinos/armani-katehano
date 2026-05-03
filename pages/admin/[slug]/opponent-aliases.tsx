import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AdminLayout, Spinner, LoginForm, Btn, useAdminAuth, apiFetch } from "@/client/admin";
import { validateAdminSlug } from "@/server/auth";

interface Alias {
  id:          string;
  myName:      string;
  listingName: string;
  notes:       string | null;
}

export default function OpponentAliasesPage({ validSlug }: { validSlug: boolean }) {
  const router = useRouter();
  const slug   = router.query.slug ?? validSlug;
  const { authed, loading: checking, loginError, handleLogin, handleLogout } = useAdminAuth(slug);

  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<Alias> | null>(null);
  const [error,   setError]   = useState<string>("");
  const [toast,   setToast]   = useState<{ msg: string; type?: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await apiFetch("/api/admin/opponent-aliases");
      const json = await res.json();
      setAliases(json.aliases ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (authed) load(); }, [authed]);

  const save = async () => {
    if (!editing) return;
    setError("");
    const isUpdate = !!editing.id;
    const res = await apiFetch("/api/admin/opponent-aliases", {
      method:  isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        ...(isUpdate ? { id: editing.id } : {}),
        myName:      editing.myName,
        listingName: editing.listingName,
        notes:       editing.notes ?? null,
      }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error ?? "Save failed"); return; }
    setEditing(null);
    await load();
  };

  const remove = async (id: string) => {
    const res = await apiFetch("/api/admin/opponent-aliases", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id }),
    });
    if (res.ok) await load();
  };

  if (checking) return <Spinner />;
  if (!authed)  return <LoginForm onLogin={handleLogin} error={loginError} />;

  return (
    <AdminLayout slug={slug} title="Opponent aliases" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <p className="text-sm text-ak-text-dim mb-4">
        Map the way you type an opponent&apos;s name to the way the listing shows it.
        The auto-import matcher tries both, so you can keep entering names your way.
      </p>

      {error && <div className="text-ak-red text-sm mb-2">{error}</div>}

      {loading ? <Spinner /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-ak-text-dim text-[10px] uppercase tracking-[0.12em]">
              <th align="left" className="py-2">My name</th>
              <th align="left">Listing name</th>
              <th align="left">Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {aliases.map(a => (
              <tr key={a.id} className="border-t border-ak-border">
                <td className="py-2">{a.myName}</td>
                <td>{a.listingName}</td>
                <td className="text-ak-text-dim">{a.notes ?? ""}</td>
                <td className="text-right">
                  <button className="text-xs underline mr-2" onClick={() => setEditing(a)}>edit</button>
                  <button className="text-xs underline text-ak-red" onClick={() => remove(a.id)}>delete</button>
                </td>
              </tr>
            ))}
            {aliases.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-ak-text-dim">No aliases yet</td></tr>
            )}
          </tbody>
        </table>
      )}

      <button className="mt-4 text-sm underline" onClick={() => setEditing({ myName: "", listingName: "", notes: "" })}>
        + add alias
      </button>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-ak-surface border border-ak-border p-4 max-w-md w-full">
            <h3 className="text-sm font-bold mb-3">{editing.id ? "Edit alias" : "New alias"}</h3>
            <label className="block text-xs uppercase tracking-[0.12em] text-ak-text-dim mb-1">My name (the way I type it)</label>
            <input className="w-full bg-black border border-ak-border p-2 mb-3 text-sm"
                   value={editing.myName ?? ""}
                   onChange={e => setEditing({ ...editing, myName: e.target.value })} />
            <label className="block text-xs uppercase tracking-[0.12em] text-ak-text-dim mb-1">Listing name (as on sportstats)</label>
            <input className="w-full bg-black border border-ak-border p-2 mb-3 text-sm"
                   value={editing.listingName ?? ""}
                   onChange={e => setEditing({ ...editing, listingName: e.target.value })} />
            <label className="block text-xs uppercase tracking-[0.12em] text-ak-text-dim mb-1">Notes</label>
            <textarea className="w-full bg-black border border-ak-border p-2 mb-3 text-sm" rows={2}
                      value={editing.notes ?? ""}
                      onChange={e => setEditing({ ...editing, notes: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button className="text-xs underline" onClick={() => setEditing(null)}>cancel</button>
              <Btn size="sm" variant="green" onClick={save}>save</Btn>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export async function getServerSideProps(ctx: any) {
  return { props: { validSlug: validateAdminSlug(ctx.params?.slug) } };
}
