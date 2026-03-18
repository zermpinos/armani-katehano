/**
 * pages/api/admin/seasons.js
 * POST /api/admin/seasons → create a new season and link leagues to it
 */

import { requireAuth }               from "../../../lib/requireAuth.js";
import { securityHeaders, auditLog } from "../../../lib/security.js";
import prisma                        from "../../../lib/prisma.js";

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, year, leagueIds } = req.body ?? {};

  if (!name || !year) {
    return res.status(400).json({ error: "Missing name or year" });
  }

  try {
    const season = await prisma.season.create({
      data: { name, year: Number(year) },
    });

    // Link existing leagues to this season
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

