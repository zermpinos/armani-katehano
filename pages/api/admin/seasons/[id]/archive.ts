import { requireAuth } from "@/server/auth";
import { auditLog, getClientIp } from "@/server/security/node";
import prisma from "@/server/db/client";
import { prodError } from "@/domain/shared/format";
import { invalidateForSeasonMutation } from "@/server/services/cache-invalidation";

async function handler(req: any, res: any) {
  const ip = getClientIp(req);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.query.id as string | undefined;
  if (!id) return res.status(400).json({ error: "Missing season id" });

  try {
    const existing = await prisma.season.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Season not found" });

    if (existing.archivedAt) {
      return res.status(200).json({ ok: true, season: existing, alreadyArchived: true });
    }

    const season = await prisma.season.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    auditLog("season_archived", { ip, seasonId: id, name: existing.name });
    await invalidateForSeasonMutation({ revalidate: (p) => res.revalidate?.(p) });
    return res.status(200).json({ ok: true, season });
  } catch (err) {
    auditLog("season_archive_error", { ip, seasonId: id, error: (err as any).message });
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);
