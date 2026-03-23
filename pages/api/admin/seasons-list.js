/**
 * pages/api/admin/seasons-list.js
 * GET /api/admin/seasons-list → list all seasons
 */

import { requireAuth }               from "../../../lib/requireAuth.js";
import { prodError }    from "../../../lib/utils.js"; //
import { securityHeaders }           from "../../../lib/security.js";
import prisma                        from "../../../lib/prisma.js";

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== "GET") return res.status(405).end();

  try {
    const seasons = await prisma.season.findMany({ orderBy: { year: "desc" } });
    return res.status(200).json({ seasons });
  } catch (err) {
    console.error("[seasons-list]", err); // ← also add this, consistent with dashboard.js
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireAuth(handler);
