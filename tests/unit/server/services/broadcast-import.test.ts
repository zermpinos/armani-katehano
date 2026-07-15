// @ts-nocheck
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const { mockPrisma, mockSendGameImportedBroadcast, mockAuditLog, state } = vi.hoisted(() => {
  const state = {
    row: null as any,
    onInitialRead: async () => {},
  };

  const mockPrisma = {
    game: {
      findUnique: vi.fn(async (args: any) => {
        if (!state.row || state.row.id !== args.where.id) return null;
        if (args.select) return { broadcastedAt: state.row.broadcastedAt };
        const snapshot = { ...state.row };
        await state.onInitialRead();
        return snapshot;
      }),
      groupBy: vi.fn(async () => [{ result: "W", _count: { result: 4 } }]),
    },
    // No await between read and write, mirroring single-statement atomicity.
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const sql = strings.join("?");
      if (!state.row || state.row.id !== values[0]) return 0;
      if (sql.includes(`"broadcastedAt" = NOW()`)) {
        // Honors the statement's own guard, so dropping it upstream fails the race test.
        if (sql.includes(`"broadcastedAt" IS NULL`) && state.row.broadcastedAt !== null) return 0;
        state.row.broadcastedAt = new Date("2026-03-02T10:00:00Z");
        return 1;
      }
      if (sql.includes(`"broadcastedAt" = NULL`)) {
        state.row.broadcastedAt = null;
        return 1;
      }
      throw new Error(`unexpected SQL: ${sql}`);
    }),
    subscriber: {
      findMany: vi.fn(async () => [
        { id: "sub-1", email: "one@example.com", token: "t1" },
        { id: "sub-2", email: "two@example.com", token: "t2" },
      ]),
    },
    playerGameStat: {
      findMany:  vi.fn(async () => []),
      aggregate: vi.fn(async () => ({ _sum: { fgm: 8, fga: 20, reb: 30, tov: 9 } })),
    },
    upcomingGame: {
      findFirst: vi.fn(async () => null),
    },
  };

  return {
    state,
    mockPrisma,
    mockSendGameImportedBroadcast: vi.fn(async () => {}),
    mockAuditLog:                  vi.fn(),
  };
});

vi.mock("@/server/db/client",                   () => ({ default: mockPrisma }));
vi.mock("@/server/integrations/email/client",   () => ({ sendGameImportedBroadcast: mockSendGameImportedBroadcast }));
vi.mock("@/server/security/node/audit-log",     () => ({ auditLog: mockAuditLog }));

import { claimAndBroadcastByGameId } from "@/server/services/broadcast-import";

const GAME_ID = "game-1";

function makeRow(overrides: any = {}) {
  return {
    id:             GAME_ID,
    opponent:       "Panionios",
    location:       "Athens",
    teamScore:      88,
    opponentScore:  81,
    result:         "W",
    playedOn:       new Date("2026-03-01T18:00:00Z"),
    notes:          "Home",
    seasonLeagueId: "sl-1",
    broadcastedAt:  null,
    seasonLeague:   { league: { name: "A1" } },
    ...overrides,
  };
}

// Releases only once every caller has arrived, so all observe the same pre-claim snapshot.
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

function auditEvents() {
  return mockAuditLog.mock.calls.map(c => c[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.row = makeRow();
  state.onInitialRead = async () => {};
  mockSendGameImportedBroadcast.mockImplementation(async () => {});
  vi.stubEnv("BREVO_SMTP_USER", "user");
  vi.stubEnv("BREVO_SMTP_PASS", "pass");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("claimAndBroadcastByGameId", () => {
  it("returns not_found for an unknown game", async () => {
    const result = await claimAndBroadcastByGameId("missing");
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(mockSendGameImportedBroadcast).not.toHaveBeenCalled();
  });

  it("does not re-send a game that is already broadcast", async () => {
    const broadcastedAt = new Date("2026-03-01T20:00:00Z");
    state.row = makeRow({ broadcastedAt });

    const result = await claimAndBroadcastByGameId(GAME_ID);

    expect(result).toEqual({ ok: true, state: "already_broadcast", broadcastedAt });
    expect(mockSendGameImportedBroadcast).not.toHaveBeenCalled();
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    expect(auditEvents()).toContain("broadcast_already_viewed");
  });

  it("sends exactly once when two callers race the claim", async () => {
    state.onInitialRead = makeBarrier(2);

    const results = await Promise.all([
      claimAndBroadcastByGameId(GAME_ID),
      claimAndBroadcastByGameId(GAME_ID),
    ]);

    const winners = results.filter(r => r.ok && r.state === "broadcasted");
    const losers  = results.filter(r => r.ok && r.state === "already_broadcast");

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(winners[0]).toEqual({ ok: true, state: "broadcasted", recipientCount: 2 });
    expect(mockSendGameImportedBroadcast).toHaveBeenCalledTimes(1);

    // Proves the loser lost the compare-and-set instead of short-circuiting on a pre-read.
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(auditEvents()).toContain("broadcast_already_claimed");
    expect(auditEvents()).not.toContain("broadcast_already_viewed");
  });

  it("clears the claim when the send fails so a retry can re-send", async () => {
    mockSendGameImportedBroadcast.mockRejectedValueOnce(new Error("smtp down"));

    await expect(claimAndBroadcastByGameId(GAME_ID)).rejects.toThrow("smtp down");
    expect(state.row.broadcastedAt).toBeNull();

    const retry = await claimAndBroadcastByGameId(GAME_ID);

    expect(retry).toEqual({ ok: true, state: "broadcasted", recipientCount: 2 });
    expect(mockSendGameImportedBroadcast).toHaveBeenCalledTimes(2);
    expect(state.row.broadcastedAt).not.toBeNull();
  });

  it("returns transport_unavailable without claiming when Brevo is unconfigured", async () => {
    vi.stubEnv("BREVO_SMTP_USER", "");

    const result = await claimAndBroadcastByGameId(GAME_ID);

    expect(result).toEqual({ ok: false, reason: "transport_unavailable" });
    expect(state.row.broadcastedAt).toBeNull();
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });
});
