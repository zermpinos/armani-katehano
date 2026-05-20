import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/db/client", () => ({
  default: {
    gameImportJob: { findUnique: vi.fn() },
    subscriber:    { count: vi.fn(), findMany: vi.fn() },
    playerGameStat:{ findMany: vi.fn() },
    $executeRaw:   vi.fn(),
  },
}));
vi.mock("@/server/security/node/audit-log", () => ({ auditLog: vi.fn() }));

const { sendGameImportedBroadcast } = vi.hoisted(() => ({
  sendGameImportedBroadcast: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/integrations/email/client", () => ({
  sendGameImportedBroadcast,
  createTransport: () => ({ sendMail: vi.fn() }),
}));

import prisma from "@/server/db/client";
import { sign } from "@/server/utils/broadcast-token";
import { verifyAndPreview, claimAndBroadcast } from "@/server/services/broadcast-import";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BROADCAST_LINK_SECRET  = "secret-long-enough-for-hmac-sha256-yay";
  process.env.BROADCAST_RECENCY_DAYS = "7";
});

describe("verifyAndPreview", () => {
  it("returns failure for invalid token", async () => {
    const result = await verifyAndPreview("garbage");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });

  it("returns already_broadcast when subscriberBroadcastAt is set", async () => {
    const token = sign("job_1");
    (prisma.gameImportJob.findUnique as any).mockResolvedValue({
      id: "job_1", state: "IMPORTED", importedGameId: "game_1",
      subscriberBroadcastAt: new Date("2026-05-10T00:00:00Z"),
      importedGame: { id: "game_1", opponent: "Opp", location: "home", teamScore: 78, opponentScore: 73, result: "W", playedOn: new Date(), notes: null, seasonLeague: { league: { name: "Δ' Εθνική 2025-26" } } },
    });
    const result = await verifyAndPreview(token);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toBe("already_broadcast");
  });

  it("returns confirmable preview when fresh", async () => {
    const token = sign("job_1");
    (prisma.gameImportJob.findUnique as any).mockResolvedValue({
      id: "job_1", state: "IMPORTED", importedGameId: "game_1",
      subscriberBroadcastAt: null,
      importedGame: { id: "game_1", opponent: "Opp", location: "home", teamScore: 78, opponentScore: 73, result: "W", playedOn: new Date(), notes: null, seasonLeague: { league: { name: "Δ' Εθνική 2025-26" } } },
    });
    (prisma.subscriber.count as any).mockResolvedValue(42);
    (prisma.playerGameStat.findMany as any).mockResolvedValue([
      { pts: 24, reb: 7, ast: 5, player: { name: "A", number: 11 } },
    ]);

    const result = await verifyAndPreview(token);
    expect(result.ok).toBe(true);
    if (result.ok && result.state === "confirmable") {
      expect(result.recipientCount).toBe(42);
      expect(result.topPerformers).toHaveLength(1);
      expect(result.game.id).toBe("game_1");
    } else {
      throw new Error("expected confirmable state");
    }
  });

  it("returns failure when job is missing", async () => {
    const token = sign("job_1");
    (prisma.gameImportJob.findUnique as any).mockResolvedValue(null);
    const result = await verifyAndPreview(token);
    expect(result.ok).toBe(false);
  });

  it("returns failure when job state is not IMPORTED", async () => {
    const token = sign("job_1");
    (prisma.gameImportJob.findUnique as any).mockResolvedValue({
      id: "job_1", state: "PENDING", importedGameId: null, subscriberBroadcastAt: null, importedGame: null,
    });
    const result = await verifyAndPreview(token);
    expect(result.ok).toBe(false);
  });
});

describe("claimAndBroadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BROADCAST_LINK_SECRET  = "secret-long-enough-for-hmac-sha256-yay";
    process.env.BROADCAST_RECENCY_DAYS = "7";
    process.env.BREVO_SMTP_USER        = "user";
    process.env.BREVO_SMTP_PASS        = "pass";
    process.env.NEXT_PUBLIC_APP_URL    = "https://armani-katehano.com";
  });

  it("returns invalid_token for tampered input", async () => {
    const out = await claimAndBroadcast({ token: "not-a-token", ip: "1.1.1.1" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("malformed");
  });

  it("returns transport_unavailable when SMTP env is missing", async () => {
    delete process.env.BREVO_SMTP_USER;
    const token = sign("job_1");
    (prisma.gameImportJob.findUnique as any).mockResolvedValue({
      id: "job_1", state: "IMPORTED", importedGameId: "game_1",
      subscriberBroadcastAt: null,
      importedGame: { id: "game_1", opponent: "Opp", location: "home", teamScore: 78, opponentScore: 73, result: "W", playedOn: new Date(), notes: null, seasonLeague: { league: { name: "Δ' Εθνική 2025-26" } } },
    });
    const out = await claimAndBroadcast({ token, ip: "1.1.1.1" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("transport_unavailable");
  });

  it("returns already_broadcast when atomic claim affects zero rows", async () => {
    const token = sign("job_1");
    (prisma.gameImportJob.findUnique as any)
      .mockResolvedValueOnce({
        id: "job_1", state: "IMPORTED", importedGameId: "game_1",
        subscriberBroadcastAt: null,
        importedGame: { id: "game_1", opponent: "Opp", location: "home", teamScore: 78, opponentScore: 73, result: "W", playedOn: new Date(), notes: null, seasonLeague: { league: { name: "Δ' Εθνική 2025-26" } } },
      })
      .mockResolvedValueOnce({ subscriberBroadcastAt: new Date("2026-05-09T00:00:00Z") });
    (prisma.$executeRaw as any).mockResolvedValue(0);
    const out = await claimAndBroadcast({ token, ip: "1.1.1.1" });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.state).toBe("already_broadcast");
    expect(sendGameImportedBroadcast).not.toHaveBeenCalled();
  });

  it("claims and dispatches the broadcast on happy path", async () => {
    const token = sign("job_1");
    (prisma.gameImportJob.findUnique as any).mockResolvedValue({
      id: "job_1", state: "IMPORTED", importedGameId: "game_1",
      subscriberBroadcastAt: null,
      importedGame: { id: "game_1", opponent: "Opp", location: "home", teamScore: 78, opponentScore: 73, result: "W", playedOn: new Date(), notes: null, seasonLeague: { league: { name: "Δ' Εθνική 2025-26" } } },
    });
    (prisma.$executeRaw as any).mockResolvedValue(1);
    (prisma.subscriber.findMany as any).mockResolvedValue([
      { id: "s1", email: "a@x.com", token: "tk1" },
    ]);
    (prisma.playerGameStat.findMany as any).mockResolvedValue([
      { pts: 24, reb: 7, ast: 5, player: { name: "A", number: 11 } },
    ]);

    const out = await claimAndBroadcast({ token, ip: "1.1.1.1" });
    expect(out.ok).toBe(true);
    if (out.ok && out.state === "broadcasted") {
      expect(out.recipientCount).toBe(1);
    } else {
      throw new Error("expected broadcasted state");
    }
    expect(sendGameImportedBroadcast).toHaveBeenCalledOnce();
  });
});
