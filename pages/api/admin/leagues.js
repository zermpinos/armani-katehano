/**
 * pages/api/admin/leagues.js
 * POST /api/admin/leagues → create a new league and optionally link to a season
 */

import { requireAuth }               from "../../../lib/requireAuth.js";
import { securityHeaders, auditLog } from "../../../lib/security.js";
import prisma                        from "../../../lib/prisma.js";

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, organizer, level, seasonId } = req.body ?? {};

  if (!name) {
    return res.status(400).json({ error: "Missing league name" });
  }

  try {
    const league = await prisma.league.create({
      data: {
        slug:      slugify(name),
        name,
        organizer: organizer ?? null,
        level:     level ?? null,
      },
    });

    // Optionally link to a season immediately
    if (seasonId) {
      await prisma.seasonLeague.create({
        data: { seasonId, leagueId: league.id },
      });
    }

    auditLog("league_created", { ip, leagueId: league.id, name });
    return res.status(201).json({ ok: true, league });
  } catch (err) {
    auditLog("league_create_error", { ip, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}

export default requireAuth(handler);
