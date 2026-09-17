// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { Readable } from "node:stream";

const { mockPrisma, mockAudit } = vi.hoisted(() => ({
  mockPrisma: { opponentAlias: { upsert: vi.fn() } },
  mockAudit:  vi.fn(),
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/security/node", () => ({ auditLog: mockAudit }));
vi.mock("@/server/security/edge", () => ({ securityHeaders: () => ({ "X-Test": "1" }) }));

import handler from "../../../../pages/api/slack/interactivity";

const SECRET = "test-signing-secret";

function body(actionId = "alias_confirm", value = { scrapedName: "ATALANTOI HAWKS", displayName: "Atalantoi Hawks" }) {
  const payload = { type: "block_actions", user: { username: "coach" }, actions: [{ action_id: actionId, value: JSON.stringify(value) }] };
  return new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
}

function sign(raw, ts, secret = SECRET) {
  return "v0=" + crypto.createHmac("sha256", secret).update(`v0:${ts}:${raw}`).digest("hex");
}

function req({ raw = body(), ts = String(Math.floor(Date.now() / 1000)), signature, method = "POST" } = {}) {
  const stream = Readable.from([Buffer.from(raw, "utf8")]);
  stream.method  = method;
  stream.headers = {
    "x-slack-signature":         signature ?? sign(raw, ts),
    "x-slack-request-timestamp": ts,
  };
  return stream;
}

function res() {
  const r = {
    statusCode: 0, body: undefined, headers: {},
    setHeader(k, v) { Reflect.set(r.headers, k, v); return r; },
    status(c) { r.statusCode = c; return r; },
    json(b)   { r.body = b; return r; },
  };
  return r;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SLACK_SIGNING_SECRET = SECRET;
  mockPrisma.opponentAlias.upsert.mockResolvedValue({});
});

describe("POST /api/slack/interactivity", () => {
  it("writes the alias when Slack's signature checks out", async () => {
    const r = res();
    await handler(req(), r);
    expect(r.statusCode).toBe(200);
    // Stored under the normalised key, so the lookup finds it.
    expect(mockPrisma.opponentAlias.upsert).toHaveBeenCalledWith({
      where:  { scrapedName: "ATALANTOI HAWKS" },
      update: { displayName: "Atalantoi Hawks" },
      create: { scrapedName: "ATALANTOI HAWKS", displayName: "Atalantoi Hawks" },
    });
    expect(r.body.replace_original).toBe(true);
  });

  // The signature is the only thing in front of this write.
  it("refuses a forged signature and writes nothing", async () => {
    const r = res();
    await handler(req({ signature: "v0=" + "0".repeat(64) }), r);
    expect(r.statusCode).toBe(401);
    expect(mockPrisma.opponentAlias.upsert).not.toHaveBeenCalled();
  });

  it("refuses a signature from a different secret", async () => {
    const raw = body();
    const ts  = String(Math.floor(Date.now() / 1000));
    const r = res();
    await handler(req({ raw, ts, signature: sign(raw, ts, "other-secret") }), r);
    expect(r.statusCode).toBe(401);
    expect(mockPrisma.opponentAlias.upsert).not.toHaveBeenCalled();
  });

  it("refuses a captured request replayed later", async () => {
    const raw = body();
    const old = String(Math.floor(Date.now() / 1000) - 600);
    const r = res();
    await handler(req({ raw, ts: old, signature: sign(raw, old) }), r);
    expect(r.statusCode).toBe(401);
    expect(mockPrisma.opponentAlias.upsert).not.toHaveBeenCalled();
  });

  it("refuses everything when the signing secret is unset", async () => {
    delete process.env.SLACK_SIGNING_SECRET;
    const r = res();
    await handler(req(), r);
    expect(r.statusCode).toBe(401);
    expect(mockPrisma.opponentAlias.upsert).not.toHaveBeenCalled();
  });

  it("tells an unverified caller nothing beyond the refusal", async () => {
    const r = res();
    await handler(req({ signature: "v0=deadbeef" }), r);
    expect(r.body).toEqual({ error: "Unauthorized" });
    // The reason is kept for us, not handed back.
    expect(mockAudit).toHaveBeenCalledWith("slack_interactivity_rejected", expect.objectContaining({ reason: expect.any(String) }));
  });

  it("records a rejection without writing an alias", async () => {
    const r = res();
    await handler(req({ raw: body("alias_reject") }), r);
    expect(r.statusCode).toBe(200);
    expect(mockPrisma.opponentAlias.upsert).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith("slack_alias_rejected", expect.objectContaining({ scrapedName: "ATALANTOI HAWKS" }));
  });

  // A valid signature proves Slack sent it, not that the contents are sane.
  it("validates the action value even on a signed request", async () => {
    const raw = body("alias_confirm", { scrapedName: "", displayName: "x" });
    const ts  = String(Math.floor(Date.now() / 1000));
    const r = res();
    await handler(req({ raw, ts, signature: sign(raw, ts) }), r);
    expect(r.statusCode).toBe(400);
    expect(mockPrisma.opponentAlias.upsert).not.toHaveBeenCalled();
  });

  it("refuses an oversized body before doing any work", async () => {
    const raw = "payload=" + "x".repeat(200 * 1024);
    const ts  = String(Math.floor(Date.now() / 1000));
    const r = res();
    await handler(req({ raw, ts, signature: sign(raw, ts) }), r);
    expect(r.statusCode).toBe(413);
    expect(mockPrisma.opponentAlias.upsert).not.toHaveBeenCalled();
  });

  it("rejects a method other than POST", async () => {
    const r = res();
    await handler(req({ method: "GET" }), r);
    expect(r.statusCode).toBe(405);
  });

  // A failed write must not look like a success, or the name is silently lost.
  it("says so when the alias could not be saved", async () => {
    mockPrisma.opponentAlias.upsert.mockRejectedValue(new Error("db down"));
    const r = res();
    await handler(req(), r);
    expect(r.statusCode).toBe(200);
    expect(r.body.text).toMatch(/Could not save/);
  });
});
