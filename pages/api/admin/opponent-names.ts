/**
 * pages/api/admin/opponent-names.ts
 * GET  /api/admin/opponent-names -> names the last poll could not place, and every display name held
 * POST /api/admin/opponent-names -> save a name, then publish the fixtures waiting on it
 */
import { requireAuth } from "@/server/auth";
import { auditLog, getClientIp } from "@/server/security/node";
import prisma from "@/server/db/client";
import { OpponentNameSchema } from "@/schemas/opponent-name";
import { handleError }  from "@/server/http/handle-error";
import { parseBody }    from "@/server/http/parse-body";
import { methodRouter } from "@/server/http/method-router";
import { aliasKey } from "@/domain/import/opponents";
import { waitingNames } from "@/domain/import/opponent-names";
import { loadOpponentAliases } from "@/server/services/import-pipeline";
import { discoverGames } from "@/server/services/discover-games";
import { syncFixtures } from "@/server/services/sync-fixtures";
import { invalidateForScheduleMutation } from "@/server/services/cache-invalidation";

// Saving reads the league listings; the nightly poll allows 60 s for the same reads plus its imports.
export const config = { maxDuration: 30 };

const PUBLISH_FAILED = "unexpected error while publishing";

async function listNames(_req: any, res: any) {
  try {
    const [aliases, run, rows] = await Promise.all([
      loadOpponentAliases(),
      prisma.cronRun.findFirst({ where: { job: "pollImports", ok: true }, orderBy: { startedAt: "desc" }, select: { summary: true } }),
      prisma.opponentAlias.findMany({ select: { displayName: true }, distinct: ["displayName"], orderBy: { displayName: "asc" } }),
    ]);
    return res.status(200).json({
      waiting: waitingNames(run?.summary, aliases),
      names:   rows.map(r => r.displayName),
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function addName(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(OpponentNameSchema, req.body, res);
  if (!data) return;
  const scrapedName = aliasKey(data.scrapedName);
  const displayName = data.displayName;

  try {
    const held = (await loadOpponentAliases()).get(scrapedName);
    if (held) return res.status(409).json({ error: `${scrapedName} is already named "${held}".` });

    await prisma.opponentAlias.create({ data: { scrapedName, displayName } });
    await auditLog("opponent_name_added", { ip, scrapedName, displayName });
  } catch (err) {
    return handleError(res, err);
  }

  try {
    const { fixtures, errors } = await discoverGames();
    const sync = await syncFixtures(fixtures, await loadOpponentAliases());
    if (sync.created.length || sync.changed.length) {
      await invalidateForScheduleMutation({ revalidate: res.revalidate });
    }
    return res.status(201).json({
      ok: true,
      published: sync.created.map(c => ({ opponent: c.opponent, scheduledFor: c.scheduledFor.toISOString() })),
      syncError: errors.length ? errors.join("; ") : null,
    });
  } catch (err) {
    console.error("[opponent-names] publish:", err);
    return res.status(201).json({ ok: true, published: [], syncError: PUBLISH_FAILED });
  }
}

export default requireAuth(methodRouter({
  GET:  listNames,
  POST: addName,
}));
