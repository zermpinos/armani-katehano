import "@/server/_internal/node-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifyResult =
  | { ok: true;  jobId: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function requireSecret(): string {
  const secret = process.env.BROADCAST_LINK_SECRET;
  if (!secret) throw new Error("BROADCAST_LINK_SECRET is not set");
  return secret;
}

function ttlMillis(): number {
  const days = Number(process.env.BROADCAST_RECENCY_DAYS ?? 7);
  return days * 24 * 60 * 60 * 1000;
}

export function sign(jobId: string): string {
  const secret = requireSecret();
  const expTs  = Date.now() + ttlMillis();
  const body   = b64urlEncode(`${jobId}.${expTs}`);
  const sig    = b64urlEncode(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verify(token: string): VerifyResult {
  const secret = process.env.BROADCAST_LINK_SECRET;
  if (!secret || !token || !token.includes(".")) {
    return { ok: false, reason: "malformed" };
  }
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "malformed" };

  const expected = createHmac("sha256", secret).update(body).digest();
  let provided: Buffer;
  try { provided = b64urlDecode(sig); } catch { return { ok: false, reason: "bad_signature" }; }
  if (provided.length !== expected.length) return { ok: false, reason: "bad_signature" };
  if (!timingSafeEqual(provided, expected)) return { ok: false, reason: "bad_signature" };

  let payload: string;
  try { payload = b64urlDecode(body).toString("utf8"); } catch { return { ok: false, reason: "malformed" }; }
  const dotIdx = payload.lastIndexOf(".");
  if (dotIdx < 0) return { ok: false, reason: "malformed" };
  const jobId = payload.slice(0, dotIdx);
  const expTs = Number(payload.slice(dotIdx + 1));
  if (!jobId || !Number.isFinite(expTs)) return { ok: false, reason: "malformed" };
  if (Date.now() > expTs) return { ok: false, reason: "expired" };

  return { ok: true, jobId };
}
