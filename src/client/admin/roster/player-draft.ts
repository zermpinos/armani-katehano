import type { Player } from "@/client/admin/shared";

export type PlayerDraft = {
  name:         string;
  number:       string;
  position:     string;
  isActive:     boolean;
  height:       string;
  weight:       string;
  photoUrl:     string;
  contactEmail: string;
};

export type LeagueJersey = { seasonLeagueId: string; label: string; number: string };

export const EMPTY_PLAYER: PlayerDraft = {
  name: "", number: "", position: "PG", isActive: true, height: "", weight: "", photoUrl: "", contactEmail: "",
};

const JERSEY = /^\d{1,2}$/;

export function toPlayerDraft(p: Player): PlayerDraft {
  return {
    name:         p.name,
    number:       String(p.number),
    position:     p.position,
    isActive:     p.isActive ?? true,
    height:       p.height ?? "",
    weight:       p.weight ?? "",
    photoUrl:     p.photoUrl ?? "",
    contactEmail: p.contactEmail ?? "",
  };
}

export function validatePlayerDraft(d: PlayerDraft, leagues: LeagueJersey[]): string | null {
  if (!d.name.trim()) return "Name is required";
  if (!JERSEY.test(d.number)) return "Jersey number must be a whole number 0-99";
  const bad = leagues.find(l => l.number !== "" && !JERSEY.test(l.number));
  if (bad) return `Jersey for ${bad.label} must be a whole number 0-99`;
  return null;
}

export function toPlayerPayload(d: PlayerDraft) {
  return {
    name:         d.name.trim(),
    number:       Number(d.number),
    position:     d.position,
    isActive:     d.isActive,
    height:       d.height.trim()       || null,
    weight:       d.weight.trim()       || null,
    photoUrl:     d.photoUrl.trim()     || null,
    contactEmail: d.contactEmail.trim() || null,
  };
}

export function toLeagueNumbers(leagues: LeagueJersey[]) {
  return leagues.map(l => ({ seasonLeagueId: l.seasonLeagueId, number: l.number === "" ? null : Number(l.number) }));
}

export function leaguesChanged(before: LeagueJersey[], after: LeagueJersey[]): boolean {
  return JSON.stringify(toLeagueNumbers(before)) !== JSON.stringify(toLeagueNumbers(after));
}

export function toOptimisticPlayer(id: string, d: PlayerDraft, base?: Player): Player {
  return { ...base, id, ...toPlayerPayload(d) } as Player;
}
