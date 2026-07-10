/**
 * pages/api/admin/leagues.ts
 * POST /api/admin/leagues -> create a new league and optionally link to a season
 */

import { requireAuth }               from '@/server/auth';
import { auditLog, getClientIp }     from "@/server/security/node";
import prisma                        from "@/server/db/client";
import { slugify } from "@/domain/players/format";
import { prodError } from "@/domain/shared/format";
import { LeagueCreateSchema }        from "@/schemas/league";
import { invalidateForLeagueMutation } from "@/server/services/cache-invalidation";

async function handler(req: any, res: any) {
  const ip = getClientIp(req);

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

    auditLog("league_created", { ip, leagueId: league.id, name });
    await invalidateForLeagueMutation({ revalidate: (p) => res.revalidate?.(p) });
    return res.status(201).json({ ok: true, league });
  } catch (err) {
    auditLog("league_create_error", { ip, error: (err as any).message });
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);