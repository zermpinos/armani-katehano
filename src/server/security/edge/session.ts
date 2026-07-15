// Edge-runtime mirror of the signature scheme in src/server/auth/session.ts,
// which cannot be imported here: it pulls in node:crypto and the node-only
// poison pill. Any change to the scheme there must be made here too.
export const SESSION_TTL_S = 4 * 60 * 60;

const BASE64URL = /^[A-Za-z0-9_-]+$/;

let cachedKey: Promise<CryptoKey> | null = null;
let cachedSecret: string | null = null;

function hmacKey(secret: string) {
  if (!cachedKey || cachedSecret !== secret) {
    cachedSecret = secret;
    cachedKey = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
  }
  return cachedKey;
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!BASE64URL.test(value)) return null;
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  try {
    return Uint8Array.from(atob(b64 + pad), c => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function toBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function verifySessionEdge(cookieValue: string | null | undefined): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !cookieValue) return null;

  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot === -1) return null;
  const data = cookieValue.slice(0, lastDot);
  const sig  = cookieValue.slice(lastDot + 1);
  if (!data || !sig) return null;

  // The node side compares base64url strings, so it rejects a non-canonical
  // encoding of an otherwise valid signature. Comparing decoded bytes here
  // would accept one: the last char of a 32-byte hmac has 2 slack bits.
  const sigBytes = fromBase64url(sig);
  if (!sigBytes || toBase64url(sigBytes) !== sig) return null;

  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      sigBytes,
      new TextEncoder().encode(data),
    );
    if (!ok) return null;
  } catch {
    return null;
  }

  const payload = fromBase64url(data);
  if (!payload) return null;
  return new TextDecoder().decode(payload);
}

export async function hasValidAdminSession(cookieValue: string | null | undefined): Promise<boolean> {
  const payload = await verifySessionEdge(cookieValue);
  if (!payload) return false;

  let parsed;
  try { parsed = JSON.parse(payload); } catch { return false; }

  if (!parsed?.ts || Date.now() - parsed.ts > SESSION_TTL_S * 1000) return false;
  return parsed.role === "admin";
}
