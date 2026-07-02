import crypto from "node:crypto";
import prisma from "@/server/db/client";
import { InviteInfoQuerySchema } from "@/schemas/player-auth";
import { securityHeaders } from "@/server/security/edge/headers";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const parsed = InviteInfoQuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid token" });
  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");

  const invite = await prisma.playerInvite.findUnique({
    where: { tokenHash },
    include: { player: true },
  });
  if (!invite) return res.status(404).json({ error: "Not found" });
  if (invite.consumedAt) return res.status(410).json({ error: "Invite already used" });
  if (invite.expiresAt.getTime() < Date.now()) return res.status(410).json({ error: "Invite expired" });

  return res.status(200).json({ playerName: invite.player.name });
}
