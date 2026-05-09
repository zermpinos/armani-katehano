import "@/server/_internal/node-only";
import { createHash } from "node:crypto";
import prisma from "@/server/db/client";
import { LOCKOUT_TTL_S, MAX_LOGIN_ATTEMPTS } from "@/server/auth/password";

export function rlKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function rlKeyBigInt(key: string): bigint {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 16);
  const unsigned = BigInt("0x" + hex);
  const SIGN_BIT = BigInt("0x8000000000000000");
  const MOD      = BigInt("0x10000000000000000");
  return unsigned >= SIGN_BIT ? unsigned - MOD : unsigned;
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

export async function atomicRecordAndCheck(
  key: string,
  maxAttempts = MAX_LOGIN_ATTEMPTS,
  windowSeconds = LOCKOUT_TTL_S,
): Promise<{ count: number; locked: boolean }> {
  const lockKey   = rlKeyBigInt(key);
  const hashedKey = rlKey(key);
  const since     = new Date(Date.now() - windowSeconds * 1000);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
    await tx.loginAttempt.create({ data: { ip: hashedKey } });
    const count = await tx.loginAttempt.count({
      where: { ip: hashedKey, attemptedAt: { gte: since } },
    });
    return { count, locked: count >= maxAttempts };
  });
}
