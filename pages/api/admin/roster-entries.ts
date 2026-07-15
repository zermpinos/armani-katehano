/**
 * pages/api/admin/roster-entries.ts
 * GET /api/admin/roster-entries  -> active-player enrollment across all seasons
 * PUT /api/admin/roster-entries  -> full sync for one season
 */

import { NextApiRequest, NextApiResponse } from "next";
import { z }                               from "zod";
import { requireAuth }                     from "@/server/auth";
import { auditLog, getClientIp }           from "@/server/security/node";
import prisma                              from "@/server/db/client";
import { methodRouter }                    from "@/server/http/method-router";
import { handleError }                     from "@/server/http/handle-error";
import { parseBody }                       from "@/server/http/parse-body";

const RosterSyncSchema = z.object({
  seasonId:  z.string().min(1),
  playerIds: z.array(z.string().min(1)),
});

async function getEntries(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = await prisma.rosterEntry.findMany({
      where: { player: { isActive: true } },
      select: {
        playerId:     true,
        seasonLeague: { select: { seasonId: true } },
      },
    });

    // deduplicate: one player may belong to multiple leagues in the same season
    const seen = new Set<string>();
    const entries: { seasonId: string; playerId: string }[] = [];
    for (const row of rows) {
      const key = `${row.seasonLeague.seasonId}:${row.playerId}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({ seasonId: row.seasonLeague.seasonId, playerId: row.playerId });
      }
    }

    return res.status(200).json({ entries });
  } catch (err) {
    return handleError(res, err);
  }
}

async function putEntries(req: NextApiRequest, res: NextApiResponse) {
  const ip   = getClientIp(req);
  const data = parseBody(RosterSyncSchema, req.body, res, "flatten");
  if (!data) return;
  const { seasonId, playerIds } = data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const season = await tx.season.findUnique({ where: { id: seasonId } });
      if (!season) throw new Error("NOT_FOUND");

      const activePlayers = await tx.player.findMany({
        where:  { isActive: true },
        select: { id: true },
      });
      const activePids = new Set(activePlayers.map((p) => p.id));

      const invalid = playerIds.filter((id) => !activePids.has(id));
      if (invalid.length > 0) {
        throw new Error(`BAD_REQUEST:Unknown or inactive player IDs: ${invalid.join(", ")}`);
      }

      const seasonLeagues = await tx.seasonLeague.findMany({
        where:  { seasonId },
        select: { id: true },
      });

      // Iterations are leagues in this one season, not roster size; the per-player writes below are already batched.
      for (const { id: seasonLeagueId } of seasonLeagues) {
        await tx.rosterEntry.deleteMany({
          where: {
            seasonLeagueId,
            player:   { isActive: true },
            playerId: { notIn: playerIds },
          },
        });

        await tx.rosterEntry.createMany({
          data:           playerIds.map((playerId) => ({ playerId, seasonLeagueId })),
          skipDuplicates: true,
        });
      }

      return { enrolled: playerIds.length, seasonLeagueCount: seasonLeagues.length };
    });

    auditLog("roster_synced", {
      ip,
      seasonId,
      seasonLeagueCount: result.seasonLeagueCount,
      enrolled:          result.enrolled,
    });

    return res.status(200).json({ ok: true, enrolled: result.enrolled });
  } catch (err) {
    const msg = (err as Error).message ?? "";
    if (msg === "NOT_FOUND") {
      return res.status(404).json({ error: "Season not found." });
    }
    if (msg.startsWith("BAD_REQUEST:")) {
      return res.status(400).json({ error: msg.slice("BAD_REQUEST:".length) });
    }
    auditLog("roster_sync_error", { ip, seasonId, error: msg });
    return handleError(res, err);
  }
}

export default requireAuth(methodRouter({ GET: getEntries, PUT: putEntries }));
