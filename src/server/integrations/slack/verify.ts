import "@/server/_internal/node-only";
import crypto from "node:crypto";

const VERSION = "v0";
// Slack's own guidance. Older than this is a replay rather than a slow network.
const MAX_SKEW_S = 300;

export type VerifyResult = { ok: true } | { ok: false; reason: string };

// Slack signs the exact bytes it sent, so the caller must pass the raw body:
// anything re-serialised from a parsed object will not match.
export function verifySlackSignature(opts: {
  signature:     string | undefined;
  timestamp:     string | undefined;
  rawBody:       string;
  signingSecret: string | undefined;
  nowSeconds?:   number;
}): VerifyResult {
  const { signature, timestamp, rawBody, signingSecret } = opts;

  if (!signingSecret)          return { ok: false, reason: "signing secret is not configured" };
  if (!signature || !timestamp) return { ok: false, reason: "missing signature headers" };

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return { ok: false, reason: "malformed timestamp" };

  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - sent) > MAX_SKEW_S) {
    return { ok: false, reason: "timestamp outside the replay window" };
  }

  // The raw header string, not the parsed number: the signature covers the
  // bytes Slack sent, and "0123" and 123 do not hash alike.
  const expected = `${VERSION}=` + crypto
    .createHmac("sha256", signingSecret)
    .update(`${VERSION}:${timestamp}:${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  // timingSafeEqual throws on a length mismatch, and the throw would itself be
  // a signal, so length is checked first and both answers look the same.
  if (a.length !== b.length)            return { ok: false, reason: "signature mismatch" };
  if (!crypto.timingSafeEqual(a, b))    return { ok: false, reason: "signature mismatch" };

  return { ok: true };
}
