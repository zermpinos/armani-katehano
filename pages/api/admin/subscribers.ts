/**
 * pages/api/admin/subscribers.ts
 * GET /api/admin/subscribers → count + email list (admin-auth protected)
 */

import { requireAuth } from "../../../lib/requireAuth";
import prisma from "../../../lib/prisma";
import { prodError } from "../../../lib/utils";

async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const subscribers = await prisma.subscriber.findMany({
      where:   { confirmedAt: { not: null } },
      orderBy: { createdAt: "desc" },
      select:  { email: true, createdAt: true },
    });
    return res.status(200).json({ count: subscribers.length, subscribers });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);
