/**
 * /api/admin/maintenance
 *   GET  ->  { enabled: boolean }
 *   POST ->  body { enabled: boolean }, writes the flag
 *
 * Controls the global maintenance redirect implemented in proxy.ts.
 */
import { requireAuth } from "@/server/auth";
import { prodError }   from "@/domain/shared/format";
import {
  getMaintenanceFlag,
  setMaintenanceFlag,
} from "@/server/services/maintenance-flag";

async function handler(req: any, res: any) {
  if (req.method === "GET") {
    try {
      const enabled = await getMaintenanceFlag();
      return res.status(200).json({ enabled });
    } catch (err) {
      console.error("[admin/maintenance:GET]", err);
      return res.status(500).json({ error: prodError(err) });
    }
  }

  if (req.method === "POST") {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (typeof body.enabled !== "boolean") {
      return res.status(400).json({ error: "Body must be { enabled: boolean }" });
    }
    try {
      await setMaintenanceFlag(body.enabled);
      return res.status(200).json({ enabled: body.enabled });
    } catch (err) {
      console.error("[admin/maintenance:POST]", err);
      return res.status(500).json({ error: prodError(err) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
