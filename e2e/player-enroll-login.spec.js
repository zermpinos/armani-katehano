/**
 * e2e/player-enroll-login.spec.js
 * Happy path: admin-issued invite lets a player set a password and log in.
 * Uses a uniquely-named player so parallel runs do not collide.
 */
import { test, expect } from "@playwright/test";
import crypto from "node:crypto";

async function loadPrisma() {
  const mod = await import("../src/server/db/client.ts");
  return mod.default;
}

const RUN_ID     = crypto.randomBytes(4).toString("hex");
const PLAYER_NAME = `E2E Person${RUN_ID}`;
const SLUG        = `e2e-player-${RUN_ID}`;
const PASSWORD    = "very-long-passphrase-1"; // gitleaks:allow

test.describe("player enroll then login", () => {
  test("enrolls with an invite, then logs in with the same credentials", async ({ page, context }) => {
    test.skip(
      !!process.env.PLAYWRIGHT_BASE_URL,
      "Seed uses local Prisma. In CI (Vercel preview) this test would need HTTP-based seeding with mock SMTP or a test-only invite lookup endpoint.",
    );
    const prisma = await loadPrisma();

    // Seed: unique player + invite. Number 99 is unlikely to collide with an active roster row.
    const player = await prisma.player.create({
      data: { slug: SLUG, name: PLAYER_NAME, number: 99, position: "SF", contactEmail: `${SLUG}@example.test` },
    });
    const token     = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.playerInvite.create({
      data: { playerId: player.id, tokenHash, expiresAt: new Date(Date.now() + 60_000) },
    });

    try {
      await page.goto(`/enroll?token=${token}`);
      await expect(page.getByRole("heading")).toContainText(PLAYER_NAME);
      await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await page.getByLabel("Confirm").fill(PASSWORD);
      await page.getByRole("button", { name: /set password/i }).click();
      await page.waitForURL(/\/$/);

      const enrolled = await prisma.playerCredential.findUnique({ where: { playerId: player.id } });
      expect(enrolled).not.toBeNull();
      const expectedUsername = expectedUsernameFor(PLAYER_NAME);
      expect(enrolled.username.startsWith(expectedUsername)).toBe(true);

      // Log out via API, then log back in via the UI.
      await context.request.post("/api/auth/player/logout");
      await page.goto("/player/login");
      await page.getByLabel("Username").fill(enrolled.username);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/$/);
    } finally {
      // Cleanup: cascade removes credential and invite via FK.
      await prisma.player.delete({ where: { id: player.id } }).catch(() => {});
    }
  });
});

function expectedUsernameFor(name) {
  // Mirrors deriveUsername logic for the happy path (no diacritics, two tokens).
  const parts = name.trim().split(/\s+/).map(t => t.toLowerCase().replace(/[^a-z]/g, ""));
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}.${parts[parts.length - 1]}`;
}
