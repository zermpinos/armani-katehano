/**
 * pages/api/coach/schedule.ts
 * GET /api/coach/schedule -> list upcoming games (read-only, coach-auth)
 */

import { requireCoachAuth } from "@/server/auth";
import prisma from "@/server/db/client";
import { prodError } from "@/domain/shared/format";

async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const schedule = await prisma.upcomingGame.findMany({
      where:   { scheduledFor: { gte: new Date() } },
      orderBy: { scheduledFor: "asc" },
    });
    return res.status(200).json({ schedule });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireCoachAuth(handler);
