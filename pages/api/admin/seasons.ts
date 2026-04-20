/**
 * pages/api/admin/seasons.js
 * POST /api/admin/seasons -> create a new season and link leagues to it
 */

import { requireAuth }               from '../../../lib/requireAuth';
import { auditLog, getClientIp }     from "../../../lib/security";
import prisma                        from "../../../lib/prisma";
import { prodError }                 from "../../../lib/utils";
import { SeasonCreateSchema }        from "@/schemas/season";

async function handler(req: any, res: any) {
  const ip = getClientIp(req);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = SeasonCreateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { name, year, leagueIds } = parsed.data;

  try {
    const season = await prisma.season.create({
      data: { name, year },
    });

    if (leagueIds?.length) {
      await prisma.seasonLeague.createMany({
        data: leagueIds.map(leagueId => ({ seasonId: season.id, leagueId })),
        skipDuplicates: true,
      });
    }

    auditLog("season_created", { ip, seasonId: season.id, name });
    return res.status(201).json({ ok: true, season });
  } catch (err) {
    auditLog("season_create_error", { ip, error: (err as any).message });
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);
