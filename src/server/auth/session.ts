import "@/server/_internal/node-only";
import crypto from "node:crypto";

const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME    = "__Host-ak_session";
export const SESSION_TTL_S = 4 * 60 * 60;

export function signSession(payload: string) {
  if (!SESSION_SECRET) throw new Error("SESSION_SECRET is not set");
  const data = Buffer.from(payload).toString("base64url");
  const sig  = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifySession(cookieValue: string | null | undefined) {
  if (!SESSION_SECRET || !cookieValue) return null;
  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot === -1) return null;
  const data = cookieValue.slice(0, lastDot);
  const sig  = cookieValue.slice(lastDot + 1);
  if (!data || !sig) return null;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  try {
    const a = Buffer.from(sig,      "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch { return null; }
  return Buffer.from(data, "base64url").toString("utf8");
}

export const verifyPayload = verifySession;

export function getSessionToken(req: any) {
  // eslint-disable-next-line security/detect-object-injection
  return req.cookies?.[COOKIE_NAME] ?? "";
}

export function buildSessionCookie(payload: string) {
  const value = signSession(payload);
  return [
    `${COOKIE_NAME}=${value}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${SESSION_TTL_S}`,
  ].join("; ");
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
