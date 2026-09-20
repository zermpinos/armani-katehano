import type { NextApiRequest, NextApiResponse } from "next";
import { getAllUpcomingGames } from "@/server/db/repositories";
import { buildIcsFeed } from "@/domain/shared/calendar";
import { securityHeaders } from "@/server/security/edge";
import { prodError } from "@/domain/shared/format";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Subscribers poll this on their own schedule, so it caches at the edge like
  // the sitemap instead of carrying the no-store securityHeaders() ships with.
  const { "Cache-Control": _cc, ...headers } = securityHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  // Outlook checks a subscribed feed with HEAD before it fetches it.
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const games = await getAllUpcomingGames();
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).send(buildIcsFeed(games));
  } catch (err) {
    console.error("[calendar/games.ics]", err);
    // Uncached, so a failed build cannot stick for an hour. Clients keep the
    // copy they already have.
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ error: prodError(err) });
  }
}
