/**
 * pages/api/admin/leagues-list.js
 * GET /api/admin/leagues-list → list all leagues
 */

import { requireAuth }               from "../../../lib/requireAuth.js";
import { securityHeaders }           from "../../../lib/security";
import { prodError }                 from "../../../lib/utils";
import prisma                        from "../../../lib/prisma";

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== "GET") return res.status(405).end();
  try {
    const leagues = await prisma.league.findMany({ orderBy: { name: "asc" } });
    return res.status(200).json({ leagues });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);
