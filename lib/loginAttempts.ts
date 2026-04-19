/**
 * lib/loginAttempts.js
 * Neon-backed brute-force protection -- replaces Upstash Redis lockout.
 */

import { createHash } from "crypto";
import prisma from "./prisma";
import { LOCKOUT_TTL_S, MAX_LOGIN_ATTEMPTS } from "./security";

/**
 * Hash any rate-limit key to a fixed 64-char hex string so arbitrary-length
 * inputs (e.g. subemail_<email>) never overflow the VarChar(64) ip column.
 */
export function rlKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function isLockedOut(
  key: string,
  maxAttempts = MAX_LOGIN_ATTEMPTS,
  windowSeconds = LOCKOUT_TTL_S,
) {
  const since = new Date(Date.now() - windowSeconds * 1000);
  const count = await prisma.loginAttempt.count({
    where: { ip: rlKey(key), attemptedAt: { gte: since } },
  });
  return count >= maxAttempts;
}

export async function pruneStaleAttempts() {
  const cutoff = new Date(Date.now() - LOCKOUT_TTL_S * 1000);
  await prisma.loginAttempt.deleteMany({ where: { attemptedAt: { lt: cutoff } } });
}

export async function recordAttempt(key: string) {
  await prisma.loginAttempt.create({ data: { ip: rlKey(key) } });
  pruneStaleAttempts().catch(err => console.error("[loginAttempts] prune failed", err));
}

export async function clearAttempts(key: string) {
  await prisma.loginAttempt.deleteMany({ where: { ip: rlKey(key) } });
}

export async function getFailureCount(key: string, windowSeconds = LOCKOUT_TTL_S): Promise<number> {
  const since = new Date(Date.now() - windowSeconds * 1000);
  return prisma.loginAttempt.count({
    where: { ip: rlKey(key), attemptedAt: { gte: since } },
  });
}

