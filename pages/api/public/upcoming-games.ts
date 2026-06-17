import { getUpcomingGamesWithAnnouncements } from "@/server/db/repositories";
import { securityHeaders } from "@/server/security/edge";
import { prodError } from "@/domain/shared/format";

export default async function handler(req: any, res: any) {
  const { "Cache-Control": _cc, ...headers } = securityHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const upcomingGames = await getUpcomingGamesWithAnnouncements();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ upcomingGames });
  } catch (err) {
    console.error("[public/upcoming-games]", err);
    return res.status(500).json({ error: prodError(err) });
  }
}
