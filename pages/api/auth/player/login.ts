import bcrypt from "bcryptjs";
import prisma from "@/server/db/client";
import { LoginSchema } from "@/schemas/player-auth";
import { buildPlayerSessionCookie } from "@/server/auth/player";
import { csrfCheck } from "@/server/auth/csrf";
import { atomicRecordAndCheck, clearAttempts } from "@/server/auth/login-attempts";
import { securityHeaders } from "@/server/security/edge/headers";
import { auditLog } from "@/server/security/node/audit-log";
import { getClientIp } from "@/server/security/node/client-ip";

const DUMMY_HASH = "$2a$12$" + "a".repeat(53);

async function recordAndCheckLockouts(ipKey: string, accountKey: string) {
  const [ipRes, accountRes] = await Promise.all([
    atomicRecordAndCheck(ipKey, 5, 15 * 60),
    atomicRecordAndCheck(accountKey, 25, 3600),
  ]);
  if (ipRes.locked) return { status: 429, body: { error: "Too many attempts. Try again later.", retryAfter: 900 } };
  if (accountRes.locked) return { status: 429, body: { error: "Too many attempts. Try again in an hour.", retryAfter: 3600 } };
  return null;
}

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

  const ipKey = `pl:${ip}`;
  const accountKey = `pl:u:${username}`;

  const lockout = await recordAndCheckLockouts(ipKey, accountKey);
  if (lockout) {
    auditLog("player_login_locked", { ip });
    return res.status(lockout.status).json(lockout.body);
  }

  const cred = await prisma.playerCredential.findUnique({ where: { username } });
  if (!cred) {
    // note: constant-time compare against a dummy hash flattens timing for unknown users.
    await bcrypt.compare(password, DUMMY_HASH);
    auditLog("player_login_unknown_user", { ip });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, cred.passwordHash);
  if (!ok) {
    auditLog("player_login_bad_password", { ip, playerId: cred.playerId });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  await Promise.all([clearAttempts(ipKey), clearAttempts(accountKey)]);

  const payload = JSON.stringify({ role: "player", playerId: cred.playerId, ts: Date.now() });
  res.setHeader("Set-Cookie", buildPlayerSessionCookie(payload));
  auditLog("player_login_ok", { ip, playerId: cred.playerId });
  return res.status(200).json({ ok: true });
}
