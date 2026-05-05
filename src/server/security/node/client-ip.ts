import "@/server/_internal/node-only";

export function getClientIp(req: any): string {
  const realIp = req.headers["x-real-ip"] as string | undefined;
  if (realIp?.trim()) return realIp.trim();

  const forwarded = req.headers["x-forwarded-for"] as string | undefined;
  if (forwarded) {
    const last = forwarded.split(",").at(-1)?.trim();
    if (last) return last;
  }

  return "unknown";
}
