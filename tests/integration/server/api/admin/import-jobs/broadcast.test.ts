import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";

vi.mock("@/server/services/broadcast-import", () => ({
  verifyAndPreview: vi.fn(),
  claimAndBroadcast: vi.fn(),
}));
vi.mock("@/server/security/node/audit-log", () => ({ auditLog: vi.fn() }));
vi.mock("@/server/auth/login-attempts", () => ({
  rlKey: (k: string) => `rl_${k}`,
}));
vi.mock("@/server/db/client", () => ({
  default: {
    loginAttempt: {
      count:  vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

import handler from "../../../../../../pages/api/admin/import-jobs/broadcast";
import { verifyAndPreview, claimAndBroadcast } from "@/server/services/broadcast-import";
import prisma from "@/server/db/client";

function makeReqRes(method: "GET" | "POST", url: string, body?: any) {
  const req = { method, url, query: Object.fromEntries(new URL(`http://x${url}`).searchParams.entries()), body, headers: { "x-forwarded-for": "1.1.1.1" }, socket: { remoteAddress: "1.1.1.1" } } as any;
  const state = { status: 200, headers: {} as Record<string, string>, payload: "" };
  const res: any = {
    status: (s: number) => { state.status = s; return res; },
    // eslint-disable-next-line security/detect-object-injection
    setHeader: (k: string, v: string) => { state.headers[k] = v; },
    send: (s: string) => { state.payload = s; return res; },
    end: () => { return res; },
    json: (o: any) => { state.payload = JSON.stringify(o); return res; },
  };
  return { req, res, state };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/admin/import-jobs/broadcast", () => {
  it("returns 400 generic HTML when token is missing", async () => {
    const ctx = makeReqRes("GET", "/api/admin/import-jobs/broadcast");
    await handler(ctx.req as NextApiRequest, ctx.res as NextApiResponse);
    expect(ctx.state.status).toBe(400);
    expect(ctx.state.payload.toLowerCase()).toContain("invalid or expired");
  });

  it("returns 400 generic HTML when verify fails", async () => {
    (verifyAndPreview as any).mockResolvedValue({ ok: false, reason: "bad_signature" });
    const ctx = makeReqRes("GET", "/api/admin/import-jobs/broadcast?token=xxx");
    await handler(ctx.req as NextApiRequest, ctx.res as NextApiResponse);
    expect(ctx.state.status).toBe(400);
    expect(ctx.state.payload.toLowerCase()).toContain("invalid or expired");
  });

  it("renders 'Already broadcast' page when state is already_broadcast", async () => {
    (verifyAndPreview as any).mockResolvedValue({
      ok: true, state: "already_broadcast",
      broadcastedAt: new Date("2026-05-10T00:00:00Z"),
      game: { id: "g1", opponent: "Opp", location: "home", teamScore: 78, opponentScore: 73, result: "W", playedOn: new Date(), venueNote: null },
    });
    const ctx = makeReqRes("GET", "/api/admin/import-jobs/broadcast?token=xxx");
    await handler(ctx.req as NextApiRequest, ctx.res as NextApiResponse);
    expect(ctx.state.status).toBe(200);
    expect(ctx.state.payload).toContain("Already broadcast");
  });

  it("renders confirmation form on confirmable state", async () => {
    (verifyAndPreview as any).mockResolvedValue({
      ok: true, state: "confirmable",
      game: { id: "g1", opponent: "Opp", location: "home", teamScore: 78, opponentScore: 73, result: "W", playedOn: new Date(), venueNote: null, competition: null },
      topPerformers: [{ number: 11, name: "A", position: "Guard", pts: 24, reb: 7, ast: 5 }],
      ctx: { teamStats: null, record: null, nextGame: null },
      recipientCount: 42,
    });
    const ctx = makeReqRes("GET", "/api/admin/import-jobs/broadcast?token=xxx");
    await handler(ctx.req as NextApiRequest, ctx.res as NextApiResponse);
    expect(ctx.state.status).toBe(200);
    expect(ctx.state.payload).toContain("Send to 42 subscribers");
    expect(ctx.state.payload).toContain("vs Opp");
    expect(ctx.state.payload).toContain('name="token"');
    expect(ctx.state.payload).toContain('value="xxx"');
  });
});

describe("POST /api/admin/import-jobs/broadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.loginAttempt.count as any).mockResolvedValue(0);
  });

  it("returns 400 when token is missing in body", async () => {
    const ctx = makeReqRes("POST", "/api/admin/import-jobs/broadcast", {});
    await handler(ctx.req as NextApiRequest, ctx.res as NextApiResponse);
    expect(ctx.state.status).toBe(400);
  });

  it("returns 429 when rate-limit exceeded", async () => {
    (prisma.loginAttempt.count as any).mockResolvedValue(11);
    const ctx = makeReqRes("POST", "/api/admin/import-jobs/broadcast", { token: "xx" });
    await handler(ctx.req as NextApiRequest, ctx.res as NextApiResponse);
    expect(ctx.state.status).toBe(429);
  });

  it("returns 400 for invalid token (claim rejects)", async () => {
    (claimAndBroadcast as any).mockResolvedValue({ ok: false, reason: "bad_signature" });
    const ctx = makeReqRes("POST", "/api/admin/import-jobs/broadcast", { token: "xx" });
    await handler(ctx.req as NextApiRequest, ctx.res as NextApiResponse);
    expect(ctx.state.status).toBe(400);
  });

  it("returns 503 when transport is unavailable", async () => {
    (claimAndBroadcast as any).mockResolvedValue({ ok: false, reason: "transport_unavailable" });
    const ctx = makeReqRes("POST", "/api/admin/import-jobs/broadcast", { token: "xx" });
    await handler(ctx.req as NextApiRequest, ctx.res as NextApiResponse);
    expect(ctx.state.status).toBe(503);
  });

  it("renders already-broadcast page when claim returns already_broadcast", async () => {
    (claimAndBroadcast as any).mockResolvedValue({ ok: true, state: "already_broadcast", broadcastedAt: new Date("2026-05-10T00:00:00Z") });
    const ctx = makeReqRes("POST", "/api/admin/import-jobs/broadcast", { token: "xx" });
    await handler(ctx.req as NextApiRequest, ctx.res as NextApiResponse);
    expect(ctx.state.status).toBe(200);
    expect(ctx.state.payload).toContain("Already broadcast");
  });

  it("renders success page on broadcasted", async () => {
    (claimAndBroadcast as any).mockResolvedValue({ ok: true, state: "broadcasted", recipientCount: 42 });
    const ctx = makeReqRes("POST", "/api/admin/import-jobs/broadcast", { token: "xx" });
    await handler(ctx.req as NextApiRequest, ctx.res as NextApiResponse);
    expect(ctx.state.status).toBe(200);
    expect(ctx.state.payload).toContain("Sent to 42 subscribers");
  });
});
