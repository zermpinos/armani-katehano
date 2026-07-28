/**
 * pages/api/admin/seasons/[id]/index.ts
 * PATCH /api/admin/seasons/:id -> set the season's date boundaries and link leagues
 */

import { requireAuth } from "@/server/auth";
import { auditLog, getClientIp } from "@/server/security/node";
import prisma from "@/server/db/client";
import { prodError } from "@/domain/shared/format";
import { SeasonUpdateSchema } from "@/schemas/season";
import { invalidateForSeasonMutation } from "@/server/services/cache-invalidation";

async function handler(req: any, res: any) {
  const ip = getClientIp(req);

  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.query.id as string | undefined;
  if (!id) return res.status(400).json({ error: "Missing season id" });

  const parsed = SeasonUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { startDate, endDate, leagueIds } = parsed.data;

  try {
    const existing = await prisma.season.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Season not found" });

    const start = startDate !== undefined ? startDate : existing.startDate;
    const end   = endDate   !== undefined ? endDate   : existing.endDate;

    // A reversed range covers no date at all, so every import would stop
    // resolving a season rather than fail visibly at the point of the mistake.
    if (start && end && start > end) {
      return res.status(400).json({ error: "The start date must fall on or before the end date." });
    }

    const season = await prisma.season.update({
      where: { id },
      data: {
        ...(startDate !== undefined && { startDate }),
        ...(endDate   !== undefined && { endDate }),
      },
    });

    if (leagueIds?.length) {
      await prisma.seasonLeague.createMany({
        data: leagueIds.map(leagueId => ({ seasonId: id, leagueId })),
        skipDuplicates: true,
      });
    }

    auditLog("season_updated", { ip, seasonId: id, name: existing.name });
    await invalidateForSeasonMutation({ revalidate: (p: string) => res.revalidate?.(p) });
    return res.status(200).json({ ok: true, season });
  } catch (err) {
    auditLog("season_update_error", { ip, seasonId: id, error: (err as any).message });
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);
