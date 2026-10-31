export const AK_IDENTIFIERS = ["ARMANI", "KATEHANO"];

// The source serves one game under several competition paths and spellings, so
// a game is known by the id after /id/.
export function sourceGameId(url: string | null | undefined): string | null {
  const id = (url ?? "").trim().split("/id/")[1]?.split(/[/?#]/)[0]?.trim();
  return id ? id.toUpperCase() : null;
}

export function sameSourceGame(a: string | null | undefined, b: string | null | undefined): boolean {
  const idA = sourceGameId(a), idB = sourceGameId(b);
  if (idA || idB) return idA === idB;
  return !!a?.trim() && a.trim() === (b ?? "").trim();
}

export function isUsTeam(name: string | null | undefined): boolean {
  if (!name) return false;
  const upper = name.toUpperCase();
  return AK_IDENTIFIERS.some(id => upper.includes(id));
}
