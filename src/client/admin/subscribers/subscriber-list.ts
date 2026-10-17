export type SubscriberRow = {
  id:          string;
  email:       string;
  createdAt:   string;
  confirmedAt: string | null;
};

export type StatusFilter = "confirmed" | "unconfirmed" | "all";

export const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "confirmed",   label: "Confirmed" },
  { value: "unconfirmed", label: "Pending" },
  { value: "all",         label: "All" },
];

export function isConfirmed(row: SubscriberRow): boolean {
  return row.confirmedAt !== null;
}

// A row can arrive twice: a new sign-up shifts later pages down, and a removal re-reads the current page.
export function mergeRows(prev: SubscriberRow[], incoming: SubscriberRow[]): SubscriberRow[] {
  const seen = new Set(prev.map(r => r.id));
  return [...prev, ...incoming.filter(r => !seen.has(r.id))];
}

export function emptyMessage(status: StatusFilter, search: string): { title: string; hint: string } {
  if (search) return { title: "No matches", hint: "Try a different search, or clear it." };
  if (status === "confirmed")
    return { title: "No confirmed subscribers", hint: "Sign-ups wait under Pending until they confirm." };
  if (status === "unconfirmed")
    return { title: "No pending sign-ups", hint: "Everyone has confirmed, or the nightly purge removed the stale ones." };
  return { title: "No subscribers yet", hint: "Subscribers appear here once visitors sign up from the public site." };
}
