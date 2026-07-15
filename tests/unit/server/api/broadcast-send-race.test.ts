// @ts-nocheck
import { vi, describe, it, expect, beforeEach, beforeAll } from "vitest";

const { mockPrisma, mockSendMail, mockAuditLog, state } = vi.hoisted(() => {
  const state = {
    logs:         [] as any[],
    sql:          [] as string[],
    queryRawCalls: 0,
    lockTail:     new Map<string, Promise<void>>(),
    onResolveSubscribers: async () => {},
  };

  // Models pg_advisory_xact_lock: callers queue on the key and the holder only
  // releases when its transaction settles, so a claim committed inside the lock
  // is visible to the next caller.
  function makeTx() {
    const tx: any = {
      $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const sql = strings.join("?");
        state.sql.push(sql);
        if (!sql.includes("pg_advisory_xact_lock")) throw new Error(`unexpected SQL: ${sql}`);
        const key  = String(values[0]);
        const prev = state.lockTail.get(key) ?? Promise.resolve();
        let release: () => void;
        const held = new Promise<void>(resolve => { release = resolve; });
        state.lockTail.set(key, prev.then(() => held));
        await prev;
        tx._release = release;
        return 1;
      }),
      $queryRaw: vi.fn(async () => { state.queryRawCalls += 1; return []; }),
      broadcastLog: {
        findFirst: vi.fn(async ({ where }: any) => state.logs.find(l => l.sentAt > where.sentAt.gt) ?? null),
        count:     vi.fn(async ({ where }: any) => state.logs.filter(l => l.sentAt > where.sentAt.gt).length),
        create:    vi.fn(async ({ data }: any) => {
          const row = { id: `log-${state.logs.length + 1}`, sentAt: new Date(), ...data };
          state.logs.push(row);
          return row;
        }),
      },
    };
    return tx;
  }

  return {
    state,
    mockSendMail: vi.fn(async () => ({})),
    mockAuditLog: vi.fn(),
    mockPrisma: {
      $transaction: vi.fn(async (fn: Function) => {
        const tx = makeTx();
        try {
          return await fn(tx);
        } finally {
          tx._release?.();
        }
      }),
      broadcastLog: {
        update: vi.fn(async ({ where, data }: any) => {
          const row = state.logs.find(l => l.id === where.id);
          if (row) Object.assign(row, data);
          return row ?? {};
        }),
        // Present so an unfixed guard reading the client outside a transaction
        // still resolves; the race assertions are what catch it.
        findFirst: vi.fn(async ({ where }: any) => state.logs.find(l => l.sentAt > where.sentAt.gt) ?? null),
        count:     vi.fn(async ({ where }: any) => state.logs.filter(l => l.sentAt > where.sentAt.gt).length),
        create:    vi.fn(async ({ data }: any) => {
          const row = { id: `log-${state.logs.length + 1}`, sentAt: new Date(), ...data };
          state.logs.push(row);
          return row;
        }),
        findMany: vi.fn(async () => []),
      },
      subscriber: {
        findMany: vi.fn(async () => {
          await state.onResolveSubscribers();
          return [{ id: "s1", email: "one@example.com", token: "t1" }];
        }),
        updateMany: vi.fn(async () => ({})),
      },
    },
  };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/auth", () => ({
  requireAuth:  (h: any) => h,
  rlKeyBigInt:  () => BigInt("7391805827675811235"),
}));
vi.mock("@/server/security/node/audit-log", () => ({ auditLog: mockAuditLog }));
vi.mock("nodemailer", () => ({
  default:         { createTransport: vi.fn(() => ({ sendMail: mockSendMail })) },
  createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
}));

beforeAll(() => {
  process.env.BREVO_SMTP_USER     = "test-user";
  process.env.BREVO_SMTP_PASS     = "test-pass";
  process.env.NEXT_PUBLIC_APP_URL = "https://test.com";
});

import handler from "@/pages/api/admin/broadcast";

function makeBarrier(parties: number) {
  let arrived = 0;
  let open: () => void;
  const gate = new Promise<void>(resolve => { open = resolve; });
  return async () => {
    arrived += 1;
    if (arrived >= parties) open();
    await gate;
  };
}

function mockReq() {
  return { method: "POST", body: { mode: "send", subject: "Hi", body: "Hello" }, query: {}, cookies: {}, headers: {} };
}

function mockRes() {
  const res: any = { statusCode: 0, body: null };
  res.status    = (c: number) => { res.statusCode = c; return res; };
  res.json      = (b: any)    => { res.body = b;       return res; };
  res.setHeader = () => {};
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.logs          = [];
  state.sql           = [];
  state.queryRawCalls = 0;
  state.lockTail      = new Map();
  state.onResolveSubscribers = async () => {};
  mockSendMail.mockImplementation(async () => ({}));
});

describe("POST mode=send - concurrent send guard", () => {
  it("lets exactly one of two racing sends through", async () => {
    // Both callers resolve subscribers before either reaches the guard, so the
    // guard itself has to break the tie rather than test sequencing.
    state.onResolveSubscribers = makeBarrier(2);
    const responses = [mockRes(), mockRes()];

    await Promise.all([
      handler(mockReq(), responses[0]),
      handler(mockReq(), responses[1]),
    ]);

    expect(responses.map(r => r.statusCode).sort()).toEqual([200, 429]);
    expect(state.logs).toHaveLength(1);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("holds the daily cap at 5 when six sends race", async () => {
    state.onResolveSubscribers = makeBarrier(6);
    const responses = Array.from({ length: 6 }, () => mockRes());

    await Promise.all(responses.map(res => handler(mockReq(), res)));

    // The 2 min cooldown alone caps this run at one winner; the point is that no
    // interleaving lets more than one claim through.
    expect(responses.filter(r => r.statusCode === 200)).toHaveLength(1);
    expect(state.logs.length).toBeLessThanOrEqual(5);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("serializes the guard on an advisory lock", async () => {
    await handler(mockReq(), mockRes());
    expect(state.sql.some(s => s.includes("pg_advisory_xact_lock"))).toBe(true);
  });

  // Regression: pg_advisory_xact_lock() returns void, which the Neon adapter
  // refuses to deserialize (P2010) if the call goes through $queryRaw.
  it("takes the lock with $executeRaw, not $queryRaw", async () => {
    await handler(mockReq(), mockRes());
    expect(state.queryRawCalls).toBe(0);
  });
});

describe("POST mode=send - claim lifecycle", () => {
  it("commits the claim before sending so the window is closed during the send", async () => {
    let logsDuringSend = -1;
    mockSendMail.mockImplementation(async () => { logsDuringSend = state.logs.length; return {}; });

    await handler(mockReq(), mockRes());

    expect(logsDuringSend).toBe(1);
  });

  it("writes delivery counts back to the claim once the send settles", async () => {
    const res = mockRes();
    await handler(mockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(state.logs[0]).toMatchObject({ recipientCount: 1, deliveredCount: 1, failedCount: 0 });
  });

  it("records a failed delivery against the claim without freeing the slot", async () => {
    mockSendMail.mockRejectedValue(new Error("smtp down"));
    const res = mockRes();

    await handler(mockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ delivered: 0, failed: 1 });
    expect(state.logs).toHaveLength(1);
    expect(state.logs[0]).toMatchObject({ deliveredCount: 0, failedCount: 1 });
  });

  it("blocks a follow-up send inside the 2 min cooldown", async () => {
    const first = mockRes();
    await handler(mockReq(), first);
    const second = mockRes();
    await handler(mockReq(), second);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });
});
