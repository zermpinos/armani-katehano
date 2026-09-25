import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./csrf";

const cache = new Map<string, unknown>();

export function storeAdminData(url: string, data: unknown) {
  cache.set(url, data);
}

export function clearAdminData() {
  cache.clear();
}

export async function loadAdminData<T>(url: string): Promise<T | undefined> {
  try {
    const res = await apiFetch(url);
    if (!res.ok) return undefined;
    const json = (await res.json()) as T;
    cache.set(url, json);
    return json;
  } catch {
    return undefined;
  }
}

export function useAdminData<T>(url: string) {
  const [data,  setData]  = useState<T | undefined>(() => cache.get(url) as T | undefined);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    const json = await loadAdminData<T>(url);
    if (json === undefined) { setError(true); return; }
    setData(json);
    setError(false);
  }, [url]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  return { data, error, refresh };
}
