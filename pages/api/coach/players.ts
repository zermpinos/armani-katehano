/**
 * pages/api/coach/players.ts
 * GET /api/coach/players → list active players (read-only, coach-auth)
 */

import { requireCoachAuth } from "../../../lib/requireCoachAuth";
import prisma from "../../../lib/prisma";
import { prodError } from "../../../lib/utils";

async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const players = await prisma.player.findMany({
      where:   { isActive: true },
      orderBy: { number: "asc" },
      select:  { id: true, name: true, number: true, position: true },
    });
    return res.status(200).json({ players });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireCoachAuth(handler);
