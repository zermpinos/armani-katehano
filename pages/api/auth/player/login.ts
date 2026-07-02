import bcrypt from "bcryptjs";
import prisma from "@/server/db/client";
import { LoginSchema } from "@/schemas/player-auth";
import { buildPlayerSessionCookie } from "@/server/auth/player";
import { csrfCheck } from "@/server/auth/csrf";
import { rlKey } from "@/server/auth/login-attempts";
import { securityHeaders } from "@/server/security/edge/headers";
import { auditLog } from "@/server/security/node/audit-log";
import { getClientIp } from "@/server/security/node/client-ip";

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW = 15 * 60;
const DUMMY_HASH = "$2a$12$" + "a".repeat(53);

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!csrfCheck(req, { strict: true })) return res.status(403).json({ error: "Forbidden" });

  const ip = getClientIp(req);
  const parsed = LoginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    auditLog("player_login_bad_input", { ip });
    return res.status(400).json({ error: "Invalid input" });
  }
  const { username, password } = parsed.data;

  const since = new Date(Date.now() - LOGIN_WINDOW * 1000);
  const attempts = await prisma.loginAttempt.count({
    where: { ip: rlKey(`pl_${ip}`), attemptedAt: { gte: since } },
  });
  if (attempts >= LOGIN_LIMIT) {
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }

  prisma.loginAttempt
    .create({ data: { ip: rlKey(`pl_${ip}`) } })
    .catch((err: unknown) => console.error("[player-login] rate-limit record failed:", err));

  const cred = await prisma.playerCredential.findUnique({ where: { username } });
  if (!cred) {
    // note: constant-time compare against a dummy hash keeps timing similar for unknown users.
    await bcrypt.compare(password, DUMMY_HASH);
    auditLog("player_login_unknown_user", { ip });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, cred.passwordHash);
  if (!ok) {
    auditLog("player_login_bad_password", { ip, username });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const payload = JSON.stringify({ role: "player", playerId: cred.playerId, ts: Date.now() });
  res.setHeader("Set-Cookie", buildPlayerSessionCookie(payload));
  auditLog("player_login_ok", { ip, playerId: cred.playerId });
  return res.status(200).json({ ok: true });
}
