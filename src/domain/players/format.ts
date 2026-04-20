const GREEK: Record<string, string> = {
  α:"a", β:"b", γ:"g", δ:"d", ε:"e", ζ:"z", η:"i", θ:"th",
  ι:"i", κ:"k", λ:"l", μ:"m", ν:"n", ξ:"x", ο:"o", π:"p",
  ρ:"r", σ:"s", ς:"s", τ:"t", υ:"y", φ:"f", χ:"ch", ψ:"ps", ω:"o",
  ά:"a", έ:"e", ή:"i", ί:"i", ό:"o", ύ:"y", ώ:"o",
  ϊ:"i", ϋ:"y", ΐ:"i", ΰ:"y",
};

export function fmt(name: string) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 1] + " " + parts[0][0].toUpperCase() + ".";
}

export function slugify(str: string) {
  return str
    .toLowerCase()
    .split("")
    .map((c: string) => GREEK[c] ?? c)
    .join("")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
