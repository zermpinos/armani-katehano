/**
 * pages/api/coach/schedule.ts
 * GET /api/coach/schedule → list upcoming games (read-only, coach-auth)
 */

import { requireCoachAuth } from "../../../lib/requireCoachAuth";
import prisma from "../../../lib/prisma";
import { prodError } from "../../../lib/utils";

async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const schedule = await prisma.upcomingGame.findMany({
      orderBy: { scheduledFor: "asc" },
    });
    return res.status(200).json({ schedule });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireCoachAuth(handler);
