/**
 * pages/api/admin/players.js
 * POST   /api/admin/players       → create player
 * PUT    /api/admin/players       → edit player
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

  // ── CREATE ────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { name, number, position, height, weight } = req.body ?? {};

    if (!name || number === undefined || !position) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const player = await prisma.player.create({
        data: {
          slug:     slugify(name),
          name,
          number:   Number(number),
          position,
          height:   height ?? null,
          weight:   weight ?? null,
          isActive: true,
        },
      });
      auditLog("player_created", { ip, playerId: player.id, name });
      return res.status(201).json({ ok: true, player });
    } catch (err) {
      auditLog("player_create_error", { ip, error: err.message });
      return res.status(500).json({ error: err.message });
    }
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  if (req.method === "PUT") {
    const { playerId, name, number, position, height, weight, isActive } = req.body ?? {};

    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    try {
      const player = await prisma.player.update({
        where: { id: playerId },
        data: {
          name,
          slug:     slugify(name),
          number:   Number(number),
          position,
          height:   height ?? null,
          weight:   weight ?? null,
          isActive: isActive ?? true,
        },
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

