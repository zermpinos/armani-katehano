/**
 * e2e/global-setup.js
 * Runs once before all E2E tests.
 *
 * Clears the loginAttempt table so that brute-force lockout state from
 * previous test runs (or manual testing) doesn't cause authenticated
 * dashboard tests to fail with "Too many attempts".
 */
import prisma from "../lib/prisma.js";

export default async function globalSetup() {
  await prisma.loginAttempt.deleteMany({});
  await prisma.$disconnect();
}
