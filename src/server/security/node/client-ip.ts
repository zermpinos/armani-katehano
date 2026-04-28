import "@/server/_internal/node-only";

export function getClientIp(req: any): string {
  return (
    (req.headers["x-real-ip"] as string | undefined)?.trim() ||
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",").pop()?.trim() ||
    "unknown"
  );
}
