import { timingSafeEqual } from "node:crypto";
import { securityHeaders } from "@/server/security/edge";
import { cronFreshness }   from "@/server/services/cron-run";

// Separate from /api/health on purpose. health is anonymous and touches nothing,
// so uptime pings add no Neon load; this one reads the database and is therefore
// gated on the cron secret. Returns 503 rather than 200-with-a-flag so an external
// prober needs no body parsing to decide.
export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret   = process.env.CRON_SECRET;
  const auth     = String(req.headers["authorization"] ?? "");
  const expected = `Bearer ${secret ?? ""}`;
  if (
    !secret ||
    auth.length !== expected.length ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.setHeader("Cache-Control", "no-store");

  let jobs;
  try {
    jobs = await cronFreshness();
  } catch (err: any) {
    return res.status(503).json({ ok: false, db: "down", error: err.message });
  }

  const stale = jobs.filter(j => j.stale).map(j => j.job);
  return res.status(stale.length ? 503 : 200).json({ ok: !stale.length, db: "up", stale, jobs });
}
