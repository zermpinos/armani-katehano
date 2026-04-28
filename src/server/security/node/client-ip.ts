import "@/server/_internal/node-only";

export function getClientIp(req: any): string {
  return (
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    "unknown"
  );
}
