/**
 * pages/api/admin/leagues-list.js
 * GET /api/admin/leagues-list -> list all leagues
 */

import { requireAuth }               from "../../../lib/requireAuth.js";
import { securityHeaders }           from "../../../lib/security.js";
import prisma                        from "../../../lib/prisma.js";

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== "GET") return res.status(405).end();
  try {
    const leagues = await prisma.league.findMany({ orderBy: { name: "asc" } });
    return res.status(200).json({ leagues });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default requireAuth(handler);
