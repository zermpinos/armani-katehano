import { loadAdminData, mutateAdminData } from "./use-admin-data";

export type SaveResult = { ok: true; body: unknown } | { ok: false; status: number; message: string };

export async function optimisticSave<T>({ url, apply, rollback, send }: {
  url:      string;
  apply:    (data: T) => T;
  rollback: (data: T) => T;
  send:     () => Promise<Response>;
}): Promise<SaveResult> {
  mutateAdminData<T>(url, apply);
  let res: Response;
  try {
    res = await send();
  } catch {
    mutateAdminData<T>(url, rollback);
    return { ok: false, status: 0, message: "Network error. Check the connection and try again." };
  }
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    mutateAdminData<T>(url, rollback);
    const error = (body as { error?: unknown }).error;
    return { ok: false, status: res.status, message: typeof error === "string" ? error : "Save failed" };
  }
  // The server is the source of truth for ids and derived fields, so reconcile quietly after the write.
  void loadAdminData<T>(url);
  return { ok: true, body };
}
