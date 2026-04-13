/**
 * e2e/global-setup.js
 * Runs once before all E2E tests.
 *
 * Clears the loginAttempt table so that brute-force lockout state from
 * previous test runs (or manual testing) doesn't cause authenticated
 * dashboard tests to fail with "Too many attempts".
 *
 * Skipped when PLAYWRIGHT_BASE_URL is set (CI against a Vercel preview):
 * - The Neon preview DB has no stale lockout state.
 * - Admin tests that do real logins require E2E_ADMIN_PASSWORD which must be
 *   explicitly opted into; tests self-skip when credentials aren't configured.
 * - We don't want to require DATABASE_URL in the E2E workflow secrets.
 */
export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_BASE_URL) return;

  const { default: prisma } = await import("../lib/prisma.js");
  await prisma.loginAttempt.deleteMany({});
  await prisma.$disconnect();
}
