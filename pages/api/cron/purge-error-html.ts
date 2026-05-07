import { timingSafeEqual }     from "node:crypto";
import { purgeStaleErrorHtml } from "@/server/services/import-job";
import { securityHeaders }     from "@/server/security/edge";
import { auditLog }            from "@/server/security/node";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

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

  try {
    await purgeStaleErrorHtml();
    auditLog("cron_purge_error_html", {});
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[purge-error-html]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
