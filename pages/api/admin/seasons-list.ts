/**
 * pages/api/admin/seasons-list.js
 * GET /api/admin/seasons-list -> list all seasons
 */

import { requireAuth }               from "@/server/auth";
import { prodError }                 from "@/domain/shared/format";
import prisma                        from "@/server/db/client";

async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const rows = await prisma.season.findMany({
      orderBy: { year: "desc" },
      include: { seasonLeagues: { select: { _count: { select: { games: true } } } } },
    });
    const seasons = rows.map(s => ({
      id:         s.id,
      name:       s.name,
      year:       s.year,
      archivedAt: s.archivedAt ? s.archivedAt.toISOString() : null,
      gameCount:  s.seasonLeagues.reduce((n, sl) => n + sl._count.games, 0),
    }));
    return res.status(200).json({ seasons });
  } catch (err) {
    console.error("[seasons-list]", err); // ← also add this, consistent with dashboard.js
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);
