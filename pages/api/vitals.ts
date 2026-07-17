import { securityHeaders } from "@/server/security/edge";

const ALLOWED = new Set(["CLS", "LCP", "INP", "FCP", "TTFB", "FID"]);

const trunc = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);

export default function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, value, id, rating, path } = req.body ?? {};
  // Accept-and-drop anything outside the known metrics so a spammed or malformed
  // beacon cannot bloat the logs, and so the client never sees an error.
  if (ALLOWED.has(name) && typeof value === "number" && Number.isFinite(value)) {
    console.log(JSON.stringify({
      type:   "[WEB_VITALS]",
      name,
      value:  Math.round(value * 100) / 100,
      rating: trunc(rating, 24),
      id:     trunc(id, 64),
      path:   trunc(path, 256),
    }));
  }
  return res.status(204).end();
}
