// @ts-nocheck
/**
 * Concurrency tests for atomicRecordAndCheck.
 *
 * These tests require a real PostgreSQL connection — they CANNOT run with a
 * mocked Prisma client, because they test that pg_advisory_xact_lock actually
 * serialises concurrent requests at the DB level.
 *
 * To run:
 *   1. Set DATABASE_URL to a real Postgres instance.
 *   2. Remove `.skip` from the describe block.
 *   3. npx vitest run tests/unit/server/auth/login-attempts-concurrency.test.ts
 *   4. Re-add `.skip` before committing.
 */
import { describe, it, expect, afterEach } from "vitest";
import { atomicRecordAndCheck, clearAttempts } from "@/server/auth";
import prisma from "@/server/db/client";

const TEST_IP = "concurrency-test-ip-" + Date.now();

afterEach(async () => {
  await clearAttempts(TEST_IP);
});

describe.skip("atomicRecordAndCheck — concurrent requests (requires real PostgreSQL)", () => {
  it("serialises writes: exactly N rows inserted, calls beyond MAX return locked=true", async () => {
    const MAX = 5;
    const TOTAL = 10;

    // Fire TOTAL concurrent calls simultaneously.
    const results = await Promise.all(
      Array.from({ length: TOTAL }, () => atomicRecordAndCheck(TEST_IP, MAX, 900)),
    );

    const lockedCount   = results.filter(r => r.locked).length;
    const unlockedCount = results.filter(r => !r.locked).length;

    // Exactly MAX calls should return locked=false (counts 1–5 are below or equal threshold).
    // The remainder return locked=true. The exact split depends on serialisation order,
    // so we check the total rather than individual positions.
    expect(unlockedCount).toBe(MAX);   // first MAX through the lock: not locked yet
    expect(lockedCount).toBe(TOTAL - MAX); // remaining: locked
    expect(results.every(r => typeof r.count === "number")).toBe(true);
  });

  it("concurrent calls for different keys do not block each other", async () => {
    const KEY_A = TEST_IP + "-a";
    const KEY_B = TEST_IP + "-b";

    const start = Date.now();
    await Promise.all([
      atomicRecordAndCheck(KEY_A, 5, 900),
      atomicRecordAndCheck(KEY_B, 5, 900),
    ]);
    const elapsed = Date.now() - start;

    // Both should complete quickly — serial execution would take ~2× as long.
    // 500 ms is a very generous ceiling for two non-blocking transactions.
    expect(elapsed).toBeLessThan(500);

    await clearAttempts(KEY_A);
    await clearAttempts(KEY_B);
  });
});
