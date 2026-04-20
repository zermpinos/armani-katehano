/**
 * pages/api/admin/players.js
 * GET  /api/admin/players -> list active players
 * POST /api/admin/players -> create player
 * PUT  /api/admin/players -> edit player
 */

import { requireAuth }               from "../../../lib/requireAuth";
import { auditLog, getClientIp }     from "../../../lib/security";
import prisma                        from "../../../lib/prisma";
import { slugify, prodError }        from "../../../lib/utils";
import { PlayerWriteSchema, PlayerUpdateSchema } from "@/schemas/player";

async function handler(req: any, res: any) {
  const ip = getClientIp(req);

  // ── LIST ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const players = await prisma.player.findMany({
        where:   { isActive: true },
        orderBy: { number: "asc" },
      });
      return res.status(200).json({ players });
    } catch (err) {
      return res.status(500).json({ error: prodError(err) });
    }
  }

  // ── CREATE ─────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = PlayerWriteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { name, number, position, height, weight, photoUrl } = parsed.data;

    try {
      // Jersey number uniqueness check
      const taken = await prisma.player.findFirst({
        where: { number, isActive: true },
      });
      if (taken) {
        return res.status(409).json({
          error: `Jersey #${number} is already assigned to ${taken.name}.`,
        });
      }

      const player = await prisma.player.create({
        data: {
          slug:     slugify(name),
          name,
          number,
          position,
          height:   height   ?? null,
          weight:   weight   ?? null,
          photoUrl: photoUrl ?? null,
          isActive: true,
        },
      });
      auditLog("player_created", { ip, playerId: player.id, name });
      return res.status(201).json({ ok: true, player });
    } catch (err) {
      auditLog("player_create_error", { ip, error: (err as any).message });
      return res.status(500).json({ error: prodError(err) });
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
      // Jersey number uniqueness check (exclude this player's own current number)
      const taken = await prisma.player.findFirst({
        where: { number, isActive: true, id: { not: playerId } },
      });
      if (taken) {
        return res.status(409).json({
          error: `Jersey #${number} is already assigned to ${taken.name}.`,
        });
      }

      const player = await prisma.player.update({
        where: { id: playerId },
        data: {
          name,
          slug:     slugify(name),
          number,
          position,
          height:   height   ?? null,
          weight:   weight   ?? null,
          photoUrl: photoUrl ?? null,
          isActive: isActive ?? true,
        },
      });
      auditLog("player_updated", { ip, playerId, name });
      return res.status(200).json({ ok: true, player });
    } catch (err) {
      auditLog("player_update_error", { ip, error: (err as any).message });
      return res.status(500).json({ error: prodError(err) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);