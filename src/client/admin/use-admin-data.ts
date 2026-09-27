import { useCallback, useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "./csrf";

type Entry = { data: unknown; error: boolean };

const NONE: Entry = { data: undefined, error: false };
const entries   = new Map<string, Entry>();
const listeners = new Set<() => void>();
const versions  = new Map<string, number>();
let generation = 0;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function put(url: string, entry: Entry) {
  entries.set(url, entry);
  emit();
}

export function storeAdminData(url: string, data: unknown) {
  put(url, { data, error: false });
}

export function clearAdminData() {
  entries.clear();
  versions.clear();
  generation++;
  emit();
}

export function mutateAdminData<T>(url: string, fn: (data: T) => T) {
  const entry = entries.get(url);
  if (entry?.data === undefined) return;
  versions.set(url, (versions.get(url) ?? 0) + 1);
  put(url, { data: fn(entry.data as T), error: entry.error });
}

export async function loadAdminData<T>(url: string): Promise<T | undefined> {
  const startedVersion    = versions.get(url) ?? 0;
  const startedGeneration = generation;
  try {
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as T;
    // A change or logout during this load is newer than its response, so the response must not overwrite it.
    if ((versions.get(url) ?? 0) === startedVersion && generation === startedGeneration) put(url, { data: json, error: false });
    return json;
  } catch {
    if ((versions.get(url) ?? 0) === startedVersion && generation === startedGeneration) put(url, { data: entries.get(url)?.data, error: true });
    return undefined;
  }
}

export function refreshAllAdminData() {
  for (const url of [...entries.keys()]) void loadAdminData(url);
}

export function useAdminData<T>(url: string) {
  const getSnapshot = useCallback(() => entries.get(url) ?? NONE, [url]);
  // Loads only run in client effects, so the server-side map is always empty and the same lookup is a safe server snapshot.
  const entry = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => { void loadAdminData(url); }, [url]);

  const refresh = useCallback(() => loadAdminData<T>(url), [url]);
  const mutate  = useCallback((fn: (data: T) => T) => mutateAdminData<T>(url, fn), [url]);

  return { data: entry.data as T | undefined, error: entry.error, refresh, mutate };
}
