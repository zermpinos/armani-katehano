import { requireAuth } from "@/server/auth";
import { claimAndBroadcastByGameId } from "@/server/services/broadcast-import";

export default requireAuth(async function handler(req: any, res: any) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { gameId } = req.body ?? {};
  if (!gameId || typeof gameId !== "string")
    return res.status(400).json({ error: "gameId required" });

  const result = await claimAndBroadcastByGameId(gameId);

  if (!result.ok) {
    const status = result.reason === "transport_unavailable" ? 503
      : result.reason === "not_found" ? 404
      : 400;
    return res.status(status).json({ error: result.reason });
  }

  if (result.state === "already_broadcast")
    return res.status(409).json({ already: true, broadcastedAt: result.broadcastedAt });

  return res.status(200).json({ ok: true, recipientCount: result.recipientCount });
});
