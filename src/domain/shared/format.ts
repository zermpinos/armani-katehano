// Spelled out rather than taken from the locale data, which differs between Node and browsers (newer en-GB says "Sept").
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(isoStr: string | null | undefined) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr; // graceful fallback for legacy format
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtMinutes(dec: number): string {
  const t = Math.round(dec * 60);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
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

export function sanitize(s: string): string {
  return s.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, 1000);
}
