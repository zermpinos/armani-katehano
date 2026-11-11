// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const GAME_ID   = "cgame00000001";
const PLAYER_ID = "cplayer000001";
const EMAIL_KEY = "rl:roster_email";

const { mockPrisma, mockSend, mockAuditLog, state } = vi.hoisted(() => {
  const state = {
    attempts:     [] as { ip: string; attemptedAt: Date }[],
    announcement: null as any,
    sql:          [] as string[],
    queryRawCalls: 0,
    lockTail:     new Map<string, Promise<void>>(),
    beforeLookup: async () => {},
  };

  const withPlayers = (a: any) => ({
    ...a,
    players: [{ note: null, player: { id: PLAYER_ID, name: "P", number: 1, photoUrl: null } }],
  });

  const attemptRows = {
    findMany: vi.fn(async ({ where }: any) =>
      state.attempts.filter(r => r.ip === where.ip && r.attemptedAt >= where.attemptedAt.gte)),
    count: vi.fn(async ({ where }: any) =>
      state.attempts.filter(r => r.ip === where.ip && r.attemptedAt >= where.attemptedAt.gte).length),
    create: vi.fn(async ({ data }: any) => {
      const row = { ip: data.ip, attemptedAt: new Date() };
      state.attempts.push(row);
      return row;
    }),
  };

  // Models pg_advisory_xact_lock: callers queue on the key and the holder only
  // releases when its transaction settles.
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
      loginAttempt: attemptRows,
      gameRosterAnnouncement: {
        findUnique: vi.fn(async () => state.announcement),
        update: vi.fn(async ({ data }: any) => {
          state.announcement = { ...state.announcement, message: data.message };
          return withPlayers(state.announcement);
        }),
        create: vi.fn(async ({ data }: any) => {
          state.announcement = { id: "ann-1", upcomingGameId: data.upcomingGameId, message: data.message };
          return withPlayers(state.announcement);
        }),
      },
      gameRosterPlayer: { deleteMany: vi.fn(async () => ({})) },
    };
    return tx;
  }

  return {
    state,
    mockSend:     vi.fn(async () => ({})),
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
      loginAttempt: attemptRows,
      upcomingGame: {
        findUnique: vi.fn(async () => ({
          id: GAME_ID, opponent: "X", scheduledFor: new Date("2026-11-20T20:00:00Z"),
          location: "Gym", competition: null, notes: null,
        })),
      },
      gameRosterAnnouncement: {
        findUnique: vi.fn(async () => {
          await state.beforeLookup();
          return state.announcement && withPlayers(state.announcement);
        }),
      },
      subscriber: {
        findMany: vi.fn(async () => [{ id: "s1", email: "one@example.com", token: "t1" }]),
      },
    },
  };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/auth", () => ({
  requireCoachAuth: (h: any) => h,
  rlKey:            (k: string) => `rl:${k}`,
  rlKeyBigInt:      () => BigInt("7391805827675811235"),
}));
vi.mock("@/server/security/node", () => ({
  auditLog:    mockAuditLog,
  getClientIp: () => "1.2.3.4",
}));
vi.mock("@/server/integrations/email/client", () => ({ sendRosterAnnouncement: mockSend }));
vi.mock("@/server/services/cache-invalidation", () => ({ invalidateForRosterAnnouncement: vi.fn() }));
vi.mock("@/domain/shared/format", () => ({ prodError: (e: Error) => e.message }));

import handler from "@/pages/api/coach/roster-announcement";

const publishBody = { upcomingGameId: GAME_ID, players: [{ playerId: PLAYER_ID }] };
const resendBody  = { upcomingGameId: GAME_ID, resend: true };

function mockReq(body: any) {
  return { method: "POST", body, query: {}, cookies: {}, headers: {} };
}

function mockRes() {
  const res: any = { statusCode: 0, body: null };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json   = (b: any)    => { res.body = b;       return res; };
  return res;
}

function sentAgo(minutes: number) {
  state.attempts.push({ ip: EMAIL_KEY, attemptedAt: new Date(Date.now() - minutes * 60_000) });
}

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

beforeEach(() => {
  vi.clearAllMocks();
  state.attempts      = [];
  state.announcement  = null;
  state.sql           = [];
  state.queryRawCalls = 0;
  state.lockTail      = new Map();
  state.beforeLookup  = async () => {};
});

describe("coach roster emails", () => {
  it("emails subscribers once on the first publish", async () => {
    const res = mockRes();
    await handler(mockReq(publishBody), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe("sent");
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("saves an update without emailing anyone", async () => {
    state.announcement = { id: "ann-1", upcomingGameId: GAME_ID, message: null };
    const res = mockRes();
    await handler(mockReq({ ...publishBody, message: "changed" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe("update");
    expect(state.announcement.message).toBe("changed");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends one of two racing resends", async () => {
    state.announcement = { id: "ann-1", upcomingGameId: GAME_ID, message: null };
    state.beforeLookup = makeBarrier(2);
    const responses = [mockRes(), mockRes()];

    await Promise.all(responses.map(res => handler(mockReq(resendBody), res)));

    expect(responses.map(r => r.statusCode).sort()).toEqual([200, 429]);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(state.sql.some(s => s.includes("pg_advisory_xact_lock"))).toBe(true);
    expect(state.queryRawCalls).toBe(0);
  });

  it("refuses a resend within 10 minutes of the last roster email", async () => {
    state.announcement = { id: "ann-1", upcomingGameId: GAME_ID, message: null };
    sentAgo(5);
    const res = mockRes();
    await handler(mockReq(resendBody), res);

    expect(res.statusCode).toBe(429);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("allows a resend once 10 minutes have passed", async () => {
    state.announcement = { id: "ann-1", upcomingGameId: GAME_ID, message: null };
    sentAgo(11);
    const res = mockRes();
    await handler(mockReq(resendBody), res);

    expect(res.statusCode).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("refuses a fourth roster email within a day", async () => {
    state.announcement = { id: "ann-1", upcomingGameId: GAME_ID, message: null };
    sentAgo(60); sentAgo(120); sentAgo(180);
    const res = mockRes();
    await handler(mockReq(resendBody), res);

    expect(res.statusCode).toBe(429);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("still saves a first publish when the email limit is reached", async () => {
    sentAgo(5);
    const res = mockRes();
    await handler(mockReq(publishBody), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe("limit");
    expect(state.announcement).not.toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });
});
