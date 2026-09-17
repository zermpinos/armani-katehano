// @ts-nocheck
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifySlackSignature } from "@/server/integrations/slack/verify";

const SECRET = "test-signing-secret";
const NOW    = 1_789_000_000;
const BODY   = "payload=%7B%22type%22%3A%22block_actions%22%7D";

function sign(body = BODY, ts = String(NOW), secret = SECRET) {
  return "v0=" + crypto.createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex");
}

const verify = (over = {}) => verifySlackSignature({
  signature: sign(), timestamp: String(NOW), rawBody: BODY,
  signingSecret: SECRET, nowSeconds: NOW, ...over,
});

describe("verifySlackSignature", () => {
  it("accepts a signature Slack could have produced", () => {
    expect(verify()).toEqual({ ok: true });
  });

  it("rejects a body that changed after signing", () => {
    expect(verify({ rawBody: BODY + "&injected=1" }).ok).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verify({ signature: sign(BODY, String(NOW), "wrong-secret") }).ok).toBe(false);
  });

  // Without this a captured request stays usable for as long as the secret does.
  it("rejects a replay outside the five minute window", () => {
    const old = String(NOW - 301);
    const r = verify({ timestamp: old, signature: sign(BODY, old) });
    expect(r).toEqual({ ok: false, reason: "timestamp outside the replay window" });
  });

  it("accepts one inside the window", () => {
    const recent = String(NOW - 299);
    expect(verify({ timestamp: recent, signature: sign(BODY, recent) })).toEqual({ ok: true });
  });

  // A clock ahead of Slack's is as suspicious as one behind it.
  it("rejects a timestamp from the future", () => {
    const ahead = String(NOW + 301);
    expect(verify({ timestamp: ahead, signature: sign(BODY, ahead) }).ok).toBe(false);
  });

  it("refuses to verify anything when the secret is unset", () => {
    expect(verify({ signingSecret: undefined }))
      .toEqual({ ok: false, reason: "signing secret is not configured" });
  });

  it("rejects missing or malformed headers rather than throwing", () => {
    expect(verify({ signature: undefined }).ok).toBe(false);
    expect(verify({ timestamp: undefined }).ok).toBe(false);
    expect(verify({ timestamp: "not-a-number" }).ok).toBe(false);
  });

  // timingSafeEqual throws on unequal lengths, so a truncated signature has to
  // be caught before it reaches the comparison.
  it("rejects a truncated signature without throwing", () => {
    expect(() => verify({ signature: "v0=abc" })).not.toThrow();
    expect(verify({ signature: "v0=abc" })).toEqual({ ok: false, reason: "signature mismatch" });
  });

  // The signature covers the exact bytes, so a timestamp that parses to the
  // same number but is spelt differently must not verify.
  it("binds to the timestamp as sent, not as parsed", () => {
    const padded = `0${NOW}`;
    expect(verify({ timestamp: padded, signature: sign(BODY, String(NOW)) }).ok).toBe(false);
  });
});
