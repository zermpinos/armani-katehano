/**
 * pages/api/admin/roster-entries.ts
 * GET /api/admin/roster-entries  -> active-player enrollment across all seasons
 * PUT /api/admin/roster-entries  -> full sync for one season
 */

import { z }                          from "zod";
import { requireAuth }                from "@/server/auth";
import { auditLog, getClientIp }      from "@/server/security/node";
import prisma                         from "@/server/db/client";
import { methodRouter }               from "@/server/http/method-router";
import { handleError }                from "@/server/http/handle-error";
import { parseBody }                  from "@/server/http/parse-body";

const RosterSyncSchema = z.object({
  seasonId:  z.string().min(1),
  playerIds: z.array(z.string().min(1)),
});

async function getEntries(_req: any, res: any) {
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

async function putEntries(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(RosterSyncSchema, req.body, res, "flatten");
  if (!data) return;
  const { seasonId, playerIds } = data;

  // 1. verify season exists
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) {
    return res.status(404).json({ error: "Season not found." });
  }

  // 2. fetch all active player IDs
  const activePlayers = await prisma.player.findMany({
    where:  { isActive: true },
    select: { id: true },
  });
  const activePids = new Set(activePlayers.map((p) => p.id));

  // 3. reject any unknown or retired player
  const invalid = playerIds.filter((id) => !activePids.has(id));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Unknown or inactive player IDs: ${invalid.join(", ")}` });
  }

  // 4. resolve SeasonLeague IDs for this season
  const seasonLeagues = await prisma.seasonLeague.findMany({
    where:  { seasonId },
    select: { id: true },
  });
  const slIds = seasonLeagues.map((sl) => sl.id);

  try {
    await prisma.$transaction(async (tx) => {
      for (const seasonLeagueId of slIds) {
        // 5. remove active players not in the new set (never touch retired players)
        await tx.rosterEntry.deleteMany({
          where: {
            seasonLeagueId,
            playerId: {
              in:    [...activePids],
              notIn: playerIds,
            },
          },
        });

        // 6. upsert the requested players
        await tx.rosterEntry.createMany({
          data:           playerIds.map((playerId) => ({ playerId, seasonLeagueId })),
          skipDuplicates: true,
        });
      }
    });

    auditLog("roster_synced", {
      ip,
      seasonId,
      seasonLeagueCount: slIds.length,
      enrolled:          playerIds.length,
    });

    return res.status(200).json({ ok: true, enrolled: playerIds.length });
  } catch (err) {
    auditLog("roster_sync_error", { ip, seasonId, error: (err as any).message });
    return handleError(res, err);
  }
}

export default requireAuth(methodRouter({ GET: getEntries, PUT: putEntries }));
