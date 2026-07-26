export const AK_IDENTIFIERS = ["ARMANI", "KATEHANO"];

export function isUsTeam(name: string | null | undefined): boolean {
  if (!name) return false;
  const upper = name.toUpperCase();
  return AK_IDENTIFIERS.some(id => upper.includes(id));
}
