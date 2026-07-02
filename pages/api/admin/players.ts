/**
 * pages/api/admin/players.js
 * GET  /api/admin/players -> list active players
 * POST /api/admin/players -> create player
 * PUT  /api/admin/players -> edit player
 */

import { requireAuth }               from "@/server/auth";
import { auditLog, getClientIp }     from "@/server/security/node";
import prisma                        from "@/server/db/client";
import { slugify }                   from "@/domain/players/format";
import { PlayerWriteSchema, PlayerUpdateSchema } from "@/schemas/player";
import { handleError }               from "@/server/http/handle-error";
import { parseBody }                 from "@/server/http/parse-body";
import { methodRouter }              from "@/server/http/method-router";
import { invalidateForPlayerMutation } from "@/server/services/cache-invalidation";

async function listPlayers(_req: any, res: any) {
  try {
    const players = await prisma.player.findMany({
      where:   { isActive: true },
      orderBy: { number: "asc" },
      include: {
        credential: { select: { username: true } },
        invites: {
          where:   { consumedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          take:    1,
          select:  { expiresAt: true },
        },
      },
    });
    return res.status(200).json({ players });
  } catch (err) {
    return handleError(res, err);
  }
}

async function createPlayer(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(PlayerWriteSchema, req.body, res, "flatten");
  if (!data) return;
  const { name, number, position, height, weight, photoUrl, contactEmail } = data;

  try {
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
        slug:         slugify(name),
        name,
        number,
        position,
        height:       height       ?? null,
        weight:       weight       ?? null,
        photoUrl:     photoUrl     ?? null,
        contactEmail: contactEmail ?? null,
        isActive:     true,
      },
    });
    auditLog("player_created", { ip, playerId: player.id, name });
    await invalidateForPlayerMutation({
      revalidate: (p) => res.revalidate?.(p),
      playerSlug: player.slug,
    });
    return res.status(201).json({ ok: true, player });
  } catch (err) {
    auditLog("player_create_error", { ip, error: (err as any).message });
    return handleError(res, err);
  }
}

async function updatePlayer(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(PlayerUpdateSchema, req.body, res, "flatten");
  if (!data) return;
  const { playerId, name, number, position, height, weight, isActive, photoUrl, contactEmail } = data;

  try {
    const taken = await prisma.player.findFirst({
      where: { number, isActive: true, id: { not: playerId } },
    });
    if (taken) {
      return res.status(409).json({
        error: `Jersey #${number} is already assigned to ${taken.name}.`,
      });
    }

    const previous = await prisma.player.findUniqueOrThrow({
      where:  { id: playerId },
      select: { slug: true },
    });
    const player = await prisma.player.update({
      where: { id: playerId },
      data: {
        name,
        slug:         slugify(name),
        number,
        position,
        height:       height       ?? null,
        weight:       weight       ?? null,
        photoUrl:     photoUrl     ?? null,
        contactEmail: contactEmail ?? null,
        isActive:     isActive     ?? true,
      },
    });
    auditLog("player_updated", { ip, playerId, name });
    await invalidateForPlayerMutation({
      revalidate:   (p) => res.revalidate?.(p),
      playerSlug:   player.slug,
      previousSlug: previous.slug,
    });
    return res.status(200).json({ ok: true, player });
  } catch (err) {
    auditLog("player_update_error", { ip, error: (err as any).message });
    return handleError(res, err);
  }
}

export default requireAuth(methodRouter({
  GET:  listPlayers,
  POST: createPlayer,
  PUT:  updatePlayer,
}));
