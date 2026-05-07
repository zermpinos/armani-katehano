/**
 * pages/api/games/[id].js
 * GET /api/games/:id -- returns the box score for a single game.
 * Public read-only endpoint; no auth required.
 */

import { z }                from "zod";
import { getBoxScore }      from "@/server/db/repositories";
import { prodError }        from "@/domain/shared/format";
import { securityHeaders }  from "@/server/security/edge";
import { getClientIp }      from "@/server/security/node";
import { rlKey }            from "@/server/auth";
import prisma               from "@/server/db/client";

const GAME_RL_LIMIT  = 30; // max requests per IP per minute
const GAME_RL_WINDOW = 60; // 1 minute in seconds

export default async function handler(req: any, res: any) {
  const { "Cache-Control": _cc, ...baseHeaders } = securityHeaders();
  Object.entries(baseHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") return res.status(405).end();

  const ip = getClientIp(req);
  const rateLimitKey = rlKey(`game_${ip}`);
  const since = new Date(Date.now() - GAME_RL_WINDOW * 1000);
  const attempts = await prisma.loginAttempt.count({
    where: { ip: rateLimitKey, attemptedAt: { gte: since } },
  });
  if (attempts >= GAME_RL_LIMIT) {
    return res.status(429).json({ error: "Too many requests. Try again later." });
  }
  prisma.loginAttempt.create({ data: { ip: rateLimitKey } })
    .catch((err: unknown) => console.error("[games/[id]] rate-limit record failed:", err));

  const { id } = req.query;
  if (!z.string().cuid().safeParse(id).success) {
    return res.status(400).json({ error: "Invalid game id" });
  }

  try {
    const boxScore = await getBoxScore(id);
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    return res.status(200).json({ boxScore });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}
