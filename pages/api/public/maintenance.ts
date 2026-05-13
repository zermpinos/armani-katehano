/**
 * GET /api/public/maintenance  →  { enabled: boolean }
 *
 * Read by proxy.ts (Edge runtime) on every request to decide whether to
 * redirect to the maintenance page. Public + uncached at the API layer
 * (proxy caches the result in-process for a few seconds).
 */
import { getMaintenanceFlag } from "@/server/services/maintenance-flag";
import { securityHeaders }    from "@/server/security/edge";
import { prodError }          from "@/domain/shared/format";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const enabled = await getMaintenanceFlag();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ enabled });
  } catch (err) {
    console.error("[public/maintenance]", err);
    return res.status(500).json({ error: prodError(err) });
  }
}
