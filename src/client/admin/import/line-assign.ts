import { ZERO_ROW, type Line, type NameMismatch, type ResolvedRow, type UnresolvedPlayer } from "@/domain/import/resolve";
import type { Player } from "@/client/admin/shared";

export interface LineEntry {
  number:      number;
  scrapedName: string;
  // Set when the jersey matched a roster player whose surname is not the one on the sheet.
  ownerId:     string | null;
  assignee:    string | null;
  // Held here only while the line sits on no row.
  line:        Line | null;
}

export function entriesFrom(unresolved: UnresolvedPlayer[], mismatches: NameMismatch[]): LineEntry[] {
  return [
    ...unresolved.map(u => ({ number: u.number, scrapedName: u.name, ownerId: null, assignee: null, line: u.line })),
    ...mismatches.map(m => ({ number: m.number, scrapedName: m.scrapedName, ownerId: m.playerId, assignee: m.playerId, line: null })),
  ];
}

// Lands on the player's existing row: every active player already has one, and a second row would trip the duplicate-player 400.
export function reassign(box: ResolvedRow[], entry: LineEntry, to: string | null): { box: ResolvedRow[]; entry: LineEntry } {
  if (to === entry.assignee) return { box, entry };
  const from = entry.assignee;
  const line: Line | undefined = from ? box.find(r => r.playerId === from) : entry.line ?? undefined;
  if (!line) return { box, entry };

  let next = from ? box.map(r => (r.playerId === from ? { ...ZERO_ROW, playerId: r.playerId } : r)) : box;
  if (to) {
    next = next.some(r => r.playerId === to)
      ? next.map(r => (r.playerId === to ? { ...line, playerId: to } : r))
      : [...next, { ...line, playerId: to }];
  }
  return { box: next, entry: { ...entry, assignee: to, line: to ? null : line } };
}

export function playedIn(box: ResolvedRow[]): Set<string> {
  return new Set(box.filter(r => r.min > 0).map(r => r.playerId));
}

// Holders are excluded by entry, not just by minutes: MIN can be edited to 0, and one line must never overwrite another.
export function eligiblePlayers(players: Player[], box: ResolvedRow[], entry: LineEntry, entries: LineEntry[]): Player[] {
  const taken = playedIn(box);
  for (const e of entries) if (e !== entry && e.assignee) taken.add(e.assignee);
  return players.filter(p => p.id === entry.assignee || !taken.has(p.id));
}
