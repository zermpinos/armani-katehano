// Greek uppercase to Latin per ELOT 743 (simplified subset used for names).
const GREEK_TO_LATIN = new Map<string, string>([
  ["Α","A"], ["Β","V"], ["Γ","G"], ["Δ","D"], ["Ε","E"], ["Ζ","Z"], ["Η","I"], ["Θ","TH"],
  ["Ι","I"], ["Κ","K"], ["Λ","L"], ["Μ","M"], ["Ν","N"], ["Ξ","X"], ["Ο","O"], ["Π","P"],
  ["Ρ","R"], ["Σ","S"], ["Τ","T"], ["Υ","Y"], ["Φ","F"], ["Χ","CH"], ["Ψ","PS"], ["Ω","O"],
]);

function transliterate(input: string): string {
  const withDigraphs = input.replace(/ΟΥ/g, "OU");
  let out = "";
  for (const ch of withDigraphs) {
    out += GREEK_TO_LATIN.get(ch) ?? ch;
  }
  return out;
}

function normalize(input: string): string {
  return transliterate(input.toUpperCase().normalize("NFD").replace(/\p{M}+/gu, ""))
    .replace(/[^A-Z]/g, "")
    .toLowerCase();
}

export function deriveUsername(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) throw new Error("deriveUsername: empty name");

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 1) {
    const only = normalize(tokens[0]);
    if (!only) throw new Error("deriveUsername: no ascii letters");
    return only;
  }

  const first = normalize(tokens[0]);
  const last = normalize(tokens[tokens.length - 1]);
  if (!first || !last) throw new Error("deriveUsername: no ascii letters");
  return `${first[0]}.${last}`;
}

export function deriveUsernameWithSuffix(base: string, collisions: number): string {
  return collisions === 0 ? base : `${base}${collisions + 1}`;
}
