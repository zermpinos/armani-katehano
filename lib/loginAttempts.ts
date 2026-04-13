/**
 * lib/loginAttempts.js
 * Neon-backed brute-force protection -- replaces Upstash Redis lockout.
 */

import prisma from "./prisma";
import { LOCKOUT_TTL_S, MAX_LOGIN_ATTEMPTS } from "./security";

/**
 * Returns true if the IP is currently locked out.
 */
export async function isLockedOut(ip: string) {
  const since = new Date(Date.now() - LOCKOUT_TTL_S * 1000);
  const count = await prisma.loginAttempt.count({
    where: { ip, attemptedAt: { gte: since } },
  });
  return count >= MAX_LOGIN_ATTEMPTS;
}

/**
 * Deletes all attempts older than the lockout window.
 * asynchronous -- call without await so it never blocks the request path.
 */
export async function pruneStaleAttempts() {
  const cutoff = new Date(Date.now() - LOCKOUT_TTL_S * 1000);
  await prisma.loginAttempt.deleteMany({ where: { attemptedAt: { lt: cutoff } } });
}

/**
 * Records a failed login attempt for this IP.
 * Also prunes stale rows in the background to keep the table bounded.
 */
export async function recordAttempt(ip: string) {
  await prisma.loginAttempt.create({ data: { ip } });
  // Prune rows outside the lockout window -- asynchronous, no await.
  pruneStaleAttempts().catch(err => console.error("[loginAttempts] prune failed", err));
}

/**
 * Clears all attempts for this IP on successful login.
 */
export async function clearAttempts(ip: string) {
  await prisma.loginAttempt.deleteMany({ where: { ip } });
}

