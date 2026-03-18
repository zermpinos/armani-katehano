/**
 * pages/api/admin/players.js
 * POST /api/admin/players → create player
 * PUT  /api/admin/players → edit player
 */

import { z }                         from "zod";
import { requireAuth }               from "../../../lib/requireAuth.js";
import { securityHeaders, auditLog } from "../../../lib/security.js";
import prisma                        from "../../../lib/prisma.js";

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const PlayerWriteSchema = z.object({
  name:     z.string().min(1).max(100),
  number:   z.coerce.number().int().min(0).max(99),
  position: z.enum(["PG", "SG", "SF", "PF", "C"]),
  height:   z.string().max(10).optional().nullable(),
  weight:   z.string().max(10).optional().nullable(),
  photoUrl: z.string().max(255).optional().nullable(),
});

const PlayerUpdateSchema = PlayerWriteSchema.extend({
  playerId: z.string().cuid(),
  isActive: z.boolean().optional(),
});

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  // ── CREATE ─────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = PlayerWriteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { name, number, position, height, weight, photoUrl } = parsed.data;

    try {
      const player = await prisma.player.create({
        data: { slug: slugify(name), name, number, position, height: height ?? null, weight: weight ?? null, photoUrl: photoUrl ?? null, isActive: true },
      });
      auditLog("player_created", { ip, playerId: player.id, name });
      return res.status(201).json({ ok: true, player });
    } catch (err) {
      auditLog("player_create_error", { ip, error: err.message });
      return res.status(500).json({ error: err.message });
    }
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  if (req.method === "PUT") {
    const parsed = PlayerUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { playerId, name, number, position, height, weight, isActive, photoUrl } = parsed.data;

    try {
      const player = await prisma.player.update({
        where: { id: playerId },
        data: { name, slug: slugify(name), number, position, height: height ?? null, weight: weight ?? null, photoUrl: photoUrl ?? null, isActive: isActive ?? true },
      });
      auditLog("player_updated", { ip, playerId, name });
      return res.status(200).json({ ok: true, player });
    } catch (err) {
      auditLog("player_update_error", { ip, error: err.message });
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
