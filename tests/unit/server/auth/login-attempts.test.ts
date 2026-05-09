// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

// Prisma mock -- needed because login-attempts.ts imports the client at module load.
// rlKeyBigInt is a pure function that never touches it, but the import must resolve.
const { mockPrisma, mockTx } = vi.hoisted(() => {
  const mockTx = {
    $queryRaw:     vi.fn().mockResolvedValue([]),
    loginAttempt: {
      create: vi.fn().mockResolvedValue({}),
      count:  vi.fn().mockResolvedValue(0),
    },
  };
  return {
    mockTx,
    mockPrisma: {
      $transaction: vi.fn((fn: Function) => fn(mockTx)),
      loginAttempt: {
        count:      vi.fn().mockResolvedValue(0),
        create:     vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    },
  };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));

import { rlKeyBigInt, rlKey, atomicRecordAndCheck, clearAttempts } from "@/server/auth";

// ─── rlKeyBigInt ─────────────────────────────────────────────────────────────

describe("rlKeyBigInt", () => {
  it("returns the same bigint for identical inputs", () => {
    expect(rlKeyBigInt("1.2.3.4")).toBe(rlKeyBigInt("1.2.3.4"));
  });

  it("returns different bigints for different inputs", () => {
    expect(rlKeyBigInt("1.2.3.4")).not.toBe(rlKeyBigInt("5.6.7.8"));
  });

  it("IP key and prefixed account key produce different bigints (no lock collision)", () => {
    expect(rlKeyBigInt("1.2.3.4")).not.toBe(rlKeyBigInt("account_1.2.3.4"));
  });

  it("returns a bigint", () => {
    expect(typeof rlKeyBigInt("1.2.3.4")).toBe("bigint");
  });

  it("result fits in PostgreSQL signed 64-bit range", () => {
    const MIN = BigInt("-9223372036854775808");
    const MAX = BigInt("9223372036854775807");
    const val = rlKeyBigInt("1.2.3.4");
    expect(val >= MIN && val <= MAX).toBe(true);
  });

  it("returns the known correct value for a fixed input", () => {
    expect(rlKeyBigInt("1.2.3.4")).toBe(BigInt("7391805827675811235"));
  });

  it("returns a negative bigint when hash high bit is set", () => {
    const result = rlKeyBigInt("account_admin");
    expect(result).toBeLessThan(BigInt(0));
  });
});

// ─── atomicRecordAndCheck ─────────────────────────────────────────────────────

describe("atomicRecordAndCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.$queryRaw.mockResolvedValue([]);
    mockTx.loginAttempt.create.mockResolvedValue({});
    mockTx.loginAttempt.count.mockResolvedValue(0);
    mockPrisma.$transaction.mockImplementation((fn: Function) => fn(mockTx));
  });

  it("acquires advisory lock via pg_advisory_xact_lock", async () => {
    await atomicRecordAndCheck("1.2.3.4");
    expect(mockTx.$queryRaw).toHaveBeenCalledOnce();
    const [strings] = mockTx.$queryRaw.mock.calls[0];
    expect(strings.join("")).toContain("pg_advisory_xact_lock");
  });

  it("inserts a loginAttempt record inside the transaction", async () => {
    await atomicRecordAndCheck("1.2.3.4");
    expect(mockTx.loginAttempt.create).toHaveBeenCalledOnce();
  });

  it("counts recent attempts inside the transaction", async () => {
    await atomicRecordAndCheck("1.2.3.4");
    expect(mockTx.loginAttempt.count).toHaveBeenCalledOnce();
  });

  it("returns { count, locked: false } when under max attempts", async () => {
    mockTx.loginAttempt.count.mockResolvedValue(2);
    const result = await atomicRecordAndCheck("1.2.3.4");
    expect(result).toEqual({ count: 2, locked: false });
  });

  it("returns { locked: true } when count equals maxAttempts", async () => {
    mockTx.loginAttempt.count.mockResolvedValue(5);
    const result = await atomicRecordAndCheck("1.2.3.4");
    expect(result.locked).toBe(true);
  });

  it("returns { locked: true } when count exceeds maxAttempts", async () => {
    mockTx.loginAttempt.count.mockResolvedValue(10);
    const result = await atomicRecordAndCheck("1.2.3.4");
    expect(result.locked).toBe(true);
  });

  it("propagates DB errors (fail-closed: never silently returns locked: false)", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("DB down"));
    await expect(atomicRecordAndCheck("1.2.3.4")).rejects.toThrow("DB down");
  });
});

// ─── Key-space isolation ──────────────────────────────────────────────────────

describe("key-space isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rlKey('ip') and rlKey('account_ip') are different hashes", () => {
    expect(rlKey("1.2.3.4")).not.toBe(rlKey("account_1.2.3.4"));
  });

  it("clearAttempts(ip) deletes rows using rlKey(ip)", async () => {
    await clearAttempts("1.2.3.4");
    expect(mockPrisma.loginAttempt.deleteMany).toHaveBeenCalledWith({
      where: { ip: rlKey("1.2.3.4") },
    });
  });

  it("clearAttempts(accountKey) deletes rows using rlKey(accountKey)", async () => {
    await clearAttempts("account_admin");
    expect(mockPrisma.loginAttempt.deleteMany).toHaveBeenCalledWith({
      where: { ip: rlKey("account_admin") },
    });
  });

  it("clearAttempts(ip) and clearAttempts(accountKey) target different hashes", async () => {
    await clearAttempts("1.2.3.4");
    await clearAttempts("account_1.2.3.4");
    const [firstCall, secondCall] = mockPrisma.loginAttempt.deleteMany.mock.calls;
    expect(firstCall[0].where.ip).not.toBe(secondCall[0].where.ip);
  });
});
