/**
 * pages/api/games/[id].js
 * GET /api/games/:id — returns the box score for a single game.
 * Public read-only endpoint; no auth required.
 */

import { z }           from "zod";
import { getBoxScore } from "../../../lib/data";
import { prodError }   from "../../../lib/utils";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).end();

  const { id } = req.query;
  if (!z.string().cuid().safeParse(id).success) {
    return res.status(400).json({ error: "Invalid game id" });
  }

  try {
    const boxScore = await getBoxScore(id);
    // Cache for 10 minutes — box scores are immutable once written
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    return res.status(200).json({ boxScore });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}
