/**
 * pages/api/admin/seasons.js
 * POST /api/admin/seasons -> create a new season and link leagues to it
 */

import { z }                         from "zod";
import { requireAuth }               from "../../../lib/requireAuth.js";
import { securityHeaders, auditLog } from "../../../lib/security.js";
import prisma                        from "../../../lib/prisma.js";

const SeasonCreateSchema = z.object({
  name:      z.string().min(1).max(100),
  year:      z.coerce.number().int().min(2000).max(2100),
  leagueIds: z.array(z.string().cuid()).max(20).optional(),
});

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

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
    auditLog("season_create_error", { ip, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}

export default requireAuth(handler);
