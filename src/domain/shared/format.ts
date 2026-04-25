export function fmtDate(isoStr: string | null | undefined) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr; // graceful fallback for legacy format
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtMinutes(dec: number): string {
  const m = Math.floor(dec);
  const s = Math.round((dec - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Guards against a SyntheticEvent being passed as overrideUrl when a handler is
// bound as onClick={fn} instead of onClick={() => fn()}.
export function resolveImportUrl(overrideUrl: unknown, stateUrl: string): string {
  return (typeof overrideUrl === "string" ? overrideUrl : stateUrl).trim();
}

export function prodError(err: unknown) {
  return process.env.NODE_ENV === "production"
    ? "Internal server error"
    : (err as any).message;
}
