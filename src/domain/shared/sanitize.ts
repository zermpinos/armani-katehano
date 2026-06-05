export function sanitize(s: string): string {
  return s.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, 1000);
}
