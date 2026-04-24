/**
 * pages/api/admin/leagues-list.js
 * GET /api/admin/leagues-list → list all leagues
 */

import { requireAuth }               from "@/server/auth";
import { prodError }                 from "@/domain/shared/format";
import prisma                        from "@/server/db/client";

async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).end();
  try {
    const leagues = await prisma.league.findMany({ orderBy: { name: "asc" } });
    return res.status(200).json({ leagues });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);
