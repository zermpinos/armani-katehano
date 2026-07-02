import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "@/server/db/client";
import { EnrollSchema } from "@/schemas/player-auth";
import { deriveUsername, deriveUsernameWithSuffix } from "@/server/auth/derive-username";
import { buildPlayerSessionCookie } from "@/server/auth/player";
import { csrfCheck } from "@/server/auth/csrf";
import { securityHeaders } from "@/server/security/edge/headers";
import { auditLog } from "@/server/security/node/audit-log";
import { getClientIp } from "@/server/security/node/client-ip";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!csrfCheck(req, { strict: true })) return res.status(403).json({ error: "Forbidden" });

  const parsed = EnrollSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { token, password } = parsed.data;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  type EnrollResult =
    | { status: number; body: { error: string } }
    | { status: 200; body: { ok: true; username: string }; playerId: string };

  const result: EnrollResult = await prisma.$transaction(async (tx) => {
    const invite = await tx.playerInvite.findUnique({
      where: { tokenHash },
      include: { player: true },
    });
    if (!invite) return { status: 404, body: { error: "Not found" } };
    if (invite.consumedAt) return { status: 410, body: { error: "Already used" } };
    if (invite.expiresAt.getTime() < Date.now()) return { status: 410, body: { error: "Expired" } };

    const existingCred = await tx.playerCredential.findUnique({
      where: { playerId: invite.playerId },
    });
    if (existingCred) return { status: 409, body: { error: "Already enrolled" } };

    const base = deriveUsername(invite.player.name);
    let username = base;
    let collisions = 0;
    while (await tx.playerCredential.findUnique({ where: { username } })) {
      collisions += 1;
      username = deriveUsernameWithSuffix(base, collisions);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await tx.playerCredential.create({
      data: { playerId: invite.playerId, username, passwordHash },
    });
    await tx.playerInvite.update({
      where: { tokenHash },
      data: { consumedAt: new Date() },
    });

    return { status: 200, body: { ok: true, username }, playerId: invite.playerId };
  });

  if (!("playerId" in result)) return res.status(result.status).json(result.body);

  auditLog("player_enrolled", { ip: getClientIp(req), playerId: result.playerId });
  const payload = JSON.stringify({
    role: "player",
    playerId: result.playerId,
    ts: Date.now(),
  });
  res.setHeader("Set-Cookie", buildPlayerSessionCookie(payload));
  return res.status(200).json(result.body);
}
