/**
 * pages/api/admin/leagues.js
 * POST /api/admin/leagues -> create a new league and optionally link to a season
 */

import { z }                         from "zod";
import { requireAuth }               from "../../../lib/requireAuth.js";
import { securityHeaders, auditLog } from "../../../lib/security";
import prisma                        from "../../../lib/prisma";
import { slugify, prodError }        from "../../../lib/utils";

const LeagueCreateSchema = z.object({
  name:      z.string().min(1).max(100),
  organizer: z.string().max(100).optional().nullable(),
  level:     z.string().max(50).optional().nullable(),
  seasonId:  z.string().cuid().optional(),
});

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = LeagueCreateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, organizer, level, seasonId } = parsed.data;
  const slug = slugify(name);

  // Check slug uniqueness and return a clean 409 instead of a 500
  const existing = await prisma.league.findUnique({ where: { slug } });
  if (existing) {
    return res.status(409).json({ error: `A league with the name "${name}" already exists.` });
  }

  try {
    const league = await prisma.league.create({
      data: { slug, name, organizer: organizer ?? null, level: level ?? null },
    });

    if (seasonId) {
      await prisma.seasonLeague.create({
        data: { seasonId, leagueId: league.id },
      });
    }

    auditLog("league_created", { ip, leagueId: league.id, name });
    return res.status(201).json({ ok: true, league });
  } catch (err) {
    auditLog("league_create_error", { ip, error: err.message });
    return res.status(500).json({ error: prodError(err) });  // ← prodError now imported (fixes B-02 for this file too)
  }
}

export default requireAuth(handler);