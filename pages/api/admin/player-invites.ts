import crypto from "node:crypto";
import prisma from "@/server/db/client";
import { requireAuth } from "@/server/auth/middleware/require-admin";
import { CreateInviteSchema } from "@/schemas/player-auth";
import { auditLog } from "@/server/security/node/audit-log";
import { sendPlayerInviteEmail } from "@/server/integrations/email/client";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const parsed = CreateInviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { playerId } = parsed.data;

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return res.status(404).json({ error: "Player not found" });
  if (!player.isActive) return res.status(400).json({ error: "Player is not active" });
  if (!player.contactEmail) {
    auditLog("player_invite_no_email", { playerId });
    return res.status(400).json({ error: "Player has no email on file" });
  }

  const existingCred = await prisma.playerCredential.findUnique({ where: { playerId } });
  if (existingCred) return res.status(409).json({ error: "Player already enrolled" });

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await prisma.$transaction([
    prisma.playerInvite.updateMany({
      where: { playerId, consumedAt: null },
      data:  { consumedAt: new Date() },
    }),
    prisma.playerInvite.create({ data: { playerId, tokenHash, expiresAt } }),
  ]);

  await sendPlayerInviteEmail({
    to: player.contactEmail,
    playerName: player.name,
    token,
    expiresAt,
  });

  auditLog("player_invite_sent", { playerId });
  return res.status(200).json({ ok: true, expiresAt });
}

export default requireAuth(handler);
