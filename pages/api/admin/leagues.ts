/**
 * pages/api/admin/leagues.ts
 * POST  /api/admin/leagues -> create a new league and optionally link to a season
 * PATCH /api/admin/leagues -> edit an existing league's source fields
 */

import { requireAuth }               from '@/server/auth';
import { auditLog, getClientIp }     from "@/server/security/node";
import prisma                        from "@/server/db/client";
import { slugify } from "@/domain/players/format";
import { prodError } from "@/domain/shared/format";
import { LeagueCreateSchema, LeagueUpdateSchema } from "@/schemas/league";
import { organizationName }          from "@/domain/leagues/organizations";
import { parseBody }                 from "@/server/http/parse-body";
import { methodRouter }              from "@/server/http/method-router";
import { invalidateForLeagueMutation } from "@/server/services/cache-invalidation";

async function createLeague(req: any, res: any) {
  const ip = getClientIp(req);

  const parsed = LeagueCreateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, organization, sourceSlug, listingUrl, organizer, level, seasonId } = parsed.data;
  // Prefixed so two organizations can each run a competition of the same name.
  const slug = `${organization}-${slugify(name)}`;

  // A league that returns for another year is the normal case, not a typo, and
  // this route can only attach a league it just created. Name the tool that
  // does link an existing one rather than dead-ending on the slug collision.
  const existing = await prisma.league.findUnique({ where: { slug } });
  if (existing) {
    return res.status(409).json({
      error: `${organizationName(organization)} already has a league named "${name}". To use it in another season, link it with "Link existing pair" below.`,
    });
  }

  try {
    const league = await prisma.league.create({
      data: {
        slug, name, organization,
        sourceSlug: sourceSlug ?? null,
        listingUrl: listingUrl ?? null,
        organizer:  organizer  ?? null,
        level:      level      ?? null,
      },
    });

    if (seasonId) {
      // Read existing roster outside transaction (no contention risk)
      const existingEntries = await prisma.rosterEntry.findMany({
        where: { seasonLeague: { seasonId } },
        select: { playerId: true },
      });

      await prisma.$transaction(async (tx) => {
        const sl = await tx.seasonLeague.create({
          data: { seasonId, leagueId: league.id },
        });
        if (existingEntries.length > 0) {
          await tx.rosterEntry.createMany({
            data: existingEntries.map(e => ({ playerId: e.playerId, seasonLeagueId: sl.id })),
            skipDuplicates: true,
          });
        }
        return sl;
      });
    }

    auditLog("league_created", { ip, leagueId: league.id, name, organization });
    await invalidateForLeagueMutation({ revalidate: (p) => res.revalidate?.(p) });
    return res.status(201).json({ ok: true, league });
  } catch (err) {
    auditLog("league_create_error", { ip, error: (err as any).message });
    return res.status(500).json({ error: prodError(err) });
  }
}

// Writes only the keys the caller actually sent. Spreading `?? null` across the
// rest the way the create path does would blank every field left out, which is
// how listingUrl emptied in the first place.
async function updateLeague(req: any, res: any) {
  const ip   = getClientIp(req);
  const body = parseBody(LeagueUpdateSchema, req.body, res, "flatten");
  if (!body) return;

  const { id, ...fields } = body;
  const data = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    const league = await prisma.league.update({ where: { id }, data });
    auditLog("league_updated", { ip, leagueId: id, fields: Object.keys(data) });
    await invalidateForLeagueMutation({ revalidate: (p: string) => res.revalidate?.(p) });
    return res.status(200).json({ ok: true, league });
  } catch (err) {
    if ((err as any).code === "P2025") return res.status(404).json({ error: "League not found" });
    auditLog("league_update_error", { ip, error: (err as any).message });
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(methodRouter({
  POST:  createLeague,
  PATCH: updateLeague,
}));