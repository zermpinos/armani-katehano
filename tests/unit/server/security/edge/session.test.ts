// @ts-nocheck
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-for-unit-tests";
});

let signSession, nodeTtl, verifySessionEdge, hasValidAdminSession, edgeTtl;

beforeAll(async () => {
  const node = await import("@/server/auth/session");
  signSession = node.signSession;
  nodeTtl     = node.SESSION_TTL_S;

  const edge = await import("@/server/security/edge/session");
  verifySessionEdge    = edge.verifySessionEdge;
  hasValidAdminSession = edge.hasValidAdminSession;
  edgeTtl              = edge.SESSION_TTL_S;
});

const adminPayload = (ts = Date.now()) => JSON.stringify({ ts, role: "admin", user: "admin" });

describe("edge session verify", () => {
  it("keeps the TTL in step with the node implementation", () => {
    expect(edgeTtl).toBe(nodeTtl);
  });

  it("accepts a cookie produced by the node signer", async () => {
    const payload = adminPayload();
    expect(await verifySessionEdge(signSession(payload))).toBe(payload);
  });

  it("round-trips a payload containing a dot", async () => {
    const payload = JSON.stringify({ ts: Date.now(), role: "admin", user: "first.last" });
    expect(await verifySessionEdge(signSession(payload))).toBe(payload);
  });

  it("rejects a tampered signature", async () => {
    const cookie = signSession(adminPayload());
    const dot    = cookie.lastIndexOf(".");
    const sig    = cookie.slice(dot + 1);
    // First char of the signature, where all six bits are significant; the
    // last char has two slack bits and would not always change the bytes.
    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(await verifySessionEdge(`${cookie.slice(0, dot)}.${flipped}`)).toBeNull();
  });

  it("rejects a non-canonical encoding of a valid signature, as the node side does", async () => {
    const { verifySession } = await import("@/server/auth/session");
    const cookie = signSession(adminPayload());
    const dot    = cookie.lastIndexOf(".");
    const data   = cookie.slice(0, dot);
    const sig    = cookie.slice(dot + 1);

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const sigBytes = Buffer.from(sig, "base64url");
    const twin = [...alphabet].find(c =>
      c !== sig.at(-1) && Buffer.from(sig.slice(0, -1) + c, "base64url").equals(sigBytes));
    expect(twin, "expected a slack-bit twin of the final signature char").toBeDefined();

    const variant = `${data}.${sig.slice(0, -1)}${twin}`;
    expect(variant).not.toBe(cookie);
    expect(verifySession(variant)).toBeNull();
    expect(await verifySessionEdge(variant)).toBeNull();
  });

  it("rejects a payload swapped under a valid signature", async () => {
    const cookie = signSession(adminPayload(1_000));
    const sig    = cookie.slice(cookie.lastIndexOf(".") + 1);
    const forged = Buffer.from(adminPayload(2_000)).toString("base64url");
    expect(forged).not.toBe(cookie.slice(0, cookie.lastIndexOf(".")));
    expect(await verifySessionEdge(`${forged}.${sig}`)).toBeNull();
  });

  it.each([
    ["empty", ""],
    ["null", null],
    ["undefined", undefined],
    ["no dot", "notasession"],
    ["empty signature", "abc."],
    ["empty payload", ".abc"],
    ["non-base64url signature", "abc.!!!!"],
    ["signature of the wrong length", "abc.AAAA"],
  ])("rejects %s", async (_label, value) => {
    expect(await verifySessionEdge(value)).toBeNull();
  });

  it("accepts a signature the node verifier also accepts", async () => {
    const { verifySession } = await import("@/server/auth/session");
    const cookie = signSession(adminPayload());
    expect(verifySession(cookie)).not.toBeNull();
    expect(await verifySessionEdge(cookie)).not.toBeNull();
  });
});

describe("hasValidAdminSession", () => {
  it("accepts a fresh admin session", async () => {
    expect(await hasValidAdminSession(signSession(adminPayload()))).toBe(true);
  });

  it("rejects a forged cookie", async () => {
    const data = Buffer.from(adminPayload()).toString("base64url");
    expect(await hasValidAdminSession(`${data}.${"A".repeat(43)}`)).toBe(false);
  });

  it("rejects a correctly signed but expired session", async () => {
    const stale = adminPayload(Date.now() - (edgeTtl * 1000 + 1_000));
    expect(await hasValidAdminSession(signSession(stale))).toBe(false);
  });

  it("rejects a correctly signed non-admin session", async () => {
    const coach = JSON.stringify({ ts: Date.now(), role: "coach", user: "coach" });
    expect(await hasValidAdminSession(signSession(coach))).toBe(false);
  });

  it("rejects a correctly signed session with no timestamp", async () => {
    const noTs = JSON.stringify({ role: "admin", user: "admin" });
    expect(await hasValidAdminSession(signSession(noTs))).toBe(false);
  });

  it("rejects a correctly signed payload that is not json", async () => {
    expect(await hasValidAdminSession(signSession("not json"))).toBe(false);
  });
});
