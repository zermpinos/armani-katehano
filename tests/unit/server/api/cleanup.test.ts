// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma, mockPurgeUnconfirmed, store } = vi.hoisted(() => {
  const store = { loginAttempts: [] as { id: string; attemptedAt: Date }[] };
  return {
    store,
    mockPurgeUnconfirmed: vi.fn(async () => 0),
    mockPrisma: {
      loginAttempt: {
        deleteMany: vi.fn(async ({ where }: any) => {
          const cutoff = where.attemptedAt.lt;
          const kept   = store.loginAttempts.filter(r => r.attemptedAt >= cutoff);
          const count  = store.loginAttempts.length - kept.length;
          store.loginAttempts = kept;
          return { count };
        }),
      },
      webAuthnChallenge: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    },
  };
});

vi.mock("@/server/db/client",           () => ({ default: mockPrisma }));
vi.mock("@/server/services/subscriber", () => ({ purgeUnconfirmedSubscribers: mockPurgeUnconfirmed }));

import handler from "@/pages/api/admin/cleanup";

const NOW    = new Date("2026-05-07T10:00:00Z");
const MINUTE = 60_000;
const HOUR   = 60 * MINUTE;
const SECRET = "cron-secret-long-enough-to-clear-the-32-char-check";

function ago(ms: number) {
  return new Date(NOW.getTime() - ms);
}

function mockReq(overrides: any = {}) {
  return {
    method:  overrides.method  ?? "GET",
    headers: overrides.headers ?? { authorization: `Bearer ${SECRET}` },
  };
}

function mockRes() {
  return {
    statusCode: 0, body: null,
    setHeader: vi.fn(),
    status(c: number) { this.statusCode = c; return this; },
    json(b: any)      { this.body = b;       return this; },
  } as any;
}

function survivors() {
  return store.loginAttempts.map(r => r.id).sort();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = SECRET;
  // Each row is keyed by the guard whose window it still falls inside.
  store.loginAttempts = [
    { id: "ip-lockout-10m",      attemptedAt: ago(10 * MINUTE) },
    { id: "account-lockout-30m", attemptedAt: ago(30 * MINUTE) },
    { id: "subscribe-limit-45m", attemptedAt: ago(45 * MINUTE) },
    { id: "email-cooldown-12h",  attemptedAt: ago(12 * HOUR) },
    { id: "email-cooldown-23h",  attemptedAt: ago(23 * HOUR) },
    { id: "stale-25h",           attemptedAt: ago(25 * HOUR) },
    { id: "stale-40h",           attemptedAt: ago(40 * HOUR) },
  ];
});

describe("cleanup preserves live guard windows", () => {
  it("keeps rows inside the 1 h account-lockout window", async () => {
    await handler(mockReq(), mockRes());
    expect(survivors()).toContain("account-lockout-30m");
    expect(survivors()).toContain("subscribe-limit-45m");
  });

  it("keeps rows inside the 24 h email-cooldown window", async () => {
    await handler(mockReq(), mockRes());
    expect(survivors()).toContain("email-cooldown-12h");
    expect(survivors()).toContain("email-cooldown-23h");
  });

  it("keeps rows inside the 15 min IP-lockout window", async () => {
    await handler(mockReq(), mockRes());
    expect(survivors()).toContain("ip-lockout-10m");
  });
});

describe("cleanup purges genuinely expired rows", () => {
  it("deletes only rows older than the 24 h maximum window", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(survivors()).toEqual([
      "account-lockout-30m",
      "email-cooldown-12h",
      "email-cooldown-23h",
      "ip-lockout-10m",
      "subscribe-limit-45m",
    ]);
    expect(res.body.deletedLoginAttempts).toBe(2);
  });

  it("cuts off at 24 h, the longest window any reader of this table looks back over", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(mockPrisma.loginAttempt.deleteMany).toHaveBeenCalledWith({
      where: { attemptedAt: { lt: ago(24 * HOUR) } },
    });
    expect(res.body.cutoff).toBe(ago(24 * HOUR).toISOString());
  });

  it("still purges when every row is expired", async () => {
    store.loginAttempts = [
      { id: "stale-25h", attemptedAt: ago(25 * HOUR) },
      { id: "stale-40h", attemptedAt: ago(40 * HOUR) },
    ];
    const res = mockRes();
    await handler(mockReq(), res);
    expect(survivors()).toEqual([]);
    expect(res.body.deletedLoginAttempts).toBe(2);
  });
});

describe("cleanup auth", () => {
  it("returns 405 on an unsupported method", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
    expect(mockPrisma.loginAttempt.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 with a wrong bearer of equal length", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: `Bearer ${"x".repeat(SECRET.length)}` } }), res);
    expect(res.statusCode).toBe(401);
    expect(mockPrisma.loginAttempt.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 403 when CRON_SECRET is too short to be a real secret", async () => {
    process.env.CRON_SECRET = "short";
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(403);
    expect(mockPrisma.loginAttempt.deleteMany).not.toHaveBeenCalled();
  });
});
