/**
 * pages/api/admin/test-alert.ts
 * POST /api/admin/test-alert -> send a test notification and report where it landed
 */

import { requireAuth } from "@/server/auth";
import { auditLog, getClientIp } from "@/server/security/node";
import { prodError } from "@/domain/shared/format";
import { sendImportNotification } from "@/server/integrations/email/client";

async function handler(req: any, res: any) {
  const ip = getClientIp(req);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Goes through the same call the poll makes, so a pass covers the routing,
    // the deployed webhook variable and the email fallback rather than just the
    // webhook on its own.
    const via = await sendImportNotification({ kind: "test" });
    auditLog("import_alert_tested", { ip, via });
    return res.status(200).json({ ok: true, via });
  } catch (err: any) {
    auditLog("import_alert_test_error", { ip, error: err.message });
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);
