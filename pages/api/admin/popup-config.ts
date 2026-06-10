import { requireAuth } from "@/server/auth";
import { prodError }   from "@/domain/shared/format";
import prisma from "@/server/db/client";

async function handler(req: any, res: any) {
  if (req.method === "GET") {
    try {
      const [enabledRow, versionRow] = await Promise.all([
        prisma.setting.findUnique({ where: { key: "popupEnabled" } }),
        prisma.setting.findUnique({ where: { key: "popupVersion" } }),
      ]);
      return res.status(200).json({
        enabled: enabledRow?.value === "true",
        version: parseInt(versionRow?.value ?? "1", 10),
      });
    } catch (err) {
      console.error("[admin/popup-config:GET]", err);
      return res.status(500).json({ error: prodError(err) });
    }
  }

  if (req.method === "POST") {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (typeof body.enabled !== "boolean") {
      return res.status(400).json({ error: "Body must be { enabled: boolean }" });
    }
    try {
      const versionRow = await prisma.setting.findUnique({ where: { key: "popupVersion" } });
      const currentEnabled = await prisma.setting.findUnique({ where: { key: "popupEnabled" } });
      const wasEnabled = currentEnabled?.value === "true";
      const currentVersion = parseInt(versionRow?.value ?? "1", 10);
      const nextVersion = (!wasEnabled && body.enabled) ? currentVersion + 1 : currentVersion;

      await Promise.all([
        prisma.setting.upsert({
          where:  { key: "popupEnabled" },
          update: { value: String(body.enabled) },
          create: { key: "popupEnabled", value: String(body.enabled) },
        }),
        prisma.setting.upsert({
          where:  { key: "popupVersion" },
          update: { value: String(nextVersion) },
          create: { key: "popupVersion", value: String(nextVersion) },
        }),
      ]);
      return res.status(200).json({ enabled: body.enabled, version: nextVersion });
    } catch (err) {
      console.error("[admin/popup-config:POST]", err);
      return res.status(500).json({ error: prodError(err) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
