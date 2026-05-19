import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { sign, verify } from "@/server/utils/broadcast-token";

const SECRET = "test-secret-which-is-long-enough-for-hmac-sha256";

describe("broadcast-token", () => {
  beforeEach(() => {
    process.env.BROADCAST_LINK_SECRET = SECRET;
    process.env.BROADCAST_RECENCY_DAYS = "7";
  });
  afterEach(() => {
    delete process.env.BROADCAST_LINK_SECRET;
    delete process.env.BROADCAST_RECENCY_DAYS;
  });

  it("round-trips a token for a given jobId", () => {
    const token  = sign("job_abc123");
    const result = verify(token);
    expect(result).toEqual({ ok: true, jobId: "job_abc123" });
  });

  it("rejects a token whose signature bytes have been bit-flipped", () => {
    const token = sign("job_abc123");
    const [body, sig] = token.split(".");
    const sigBytes = Buffer.from(sig, "base64url");
    sigBytes[0] ^= 0x01;
    const tampered = `${body}.${sigBytes.toString("base64url")}`;
    expect(verify(tampered)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a signature minted with a different secret", () => {
    const token = sign("job_abc123");
    const [body] = token.split(".");
    const forgedSig = createHmac("sha256", "attacker-guess-secret")
      .update(body)
      .digest()
      .toString("base64url");
    expect(verify(`${body}.${forgedSig}`)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a body mutated to extend the TTL (sig unchanged)", () => {
    const token = sign("job_abc123");
    const [body, sig] = token.split(".");
    const payload = Buffer.from(body, "base64url").toString("utf8");
    const dotIdx  = payload.lastIndexOf(".");
    const jobId   = payload.slice(0, dotIdx);
    const farFuture = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const mutatedBody = Buffer.from(`${jobId}.${farFuture}`, "utf8").toString("base64url");
    expect(verify(`${mutatedBody}.${sig}`)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects an expired token", () => {
    process.env.BROADCAST_RECENCY_DAYS = "0";   // mint with TTL = 0 days
    const token = sign("job_abc123");
    // Add a millisecond to force expiry
    return new Promise(r => setTimeout(r, 2)).then(() => {
      const result = verify(token);
      expect(result).toEqual({ ok: false, reason: "expired" });
    });
  });

  it("rejects a malformed token", () => {
    expect(verify("not-a-token")).toEqual({ ok: false, reason: "malformed" });
    expect(verify("")).toEqual({ ok: false, reason: "malformed" });
    expect(verify("only-one-segment.aaaa")).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a token with more than two segments", () => {
    expect(verify("a.b.c")).toEqual({ ok: false, reason: "malformed" });
    expect(verify("seg.seg.seg.seg")).toEqual({ ok: false, reason: "malformed" });
  });

  it("throws when the secret is missing at sign time", () => {
    delete process.env.BROADCAST_LINK_SECRET;
    expect(() => sign("job_abc123")).toThrow(/BROADCAST_LINK_SECRET/);
  });

  it("returns malformed when the secret is missing at verify time", () => {
    const token = sign("job_abc123");
    delete process.env.BROADCAST_LINK_SECRET;
    expect(verify(token)).toEqual({ ok: false, reason: "malformed" });
  });
});
